/**
 * Breakevens CER / tasa fija.
 *
 * QUÉ ES
 * Un bono fija rinde una TIR nominal en pesos; un CER, una TIR real. La
 * inflación que iguala las dos es el breakeven: (1 + nominal) / (1 + real) − 1
 * en TEA, o llevado al plazo del bono, la inflación ACUMULADA que tiene que
 * haber para que dé lo mismo comprar uno u otro. Por encima gana el CER, por
 * debajo la fija.
 *
 * SÓLO PARES
 * Se compara únicamente cuando el Tesoro emitió una fija y un CER al MISMO
 * vencimiento (S30O6 / TZXO6). Interpolar la curva CER a la duration de una
 * fija sin par mete el error de la interpolación adentro de un número que se
 * lee en centésimas de punto mensual; no vale la pena.
 *
 * EL FACTOR DE INDEXACIÓN, EN TRES PEDAZOS
 * Sigue la Nota Técnica 8/2024 del BCRA (Matarrelli y Pastore), apéndice. El
 * CER que cobra el bono es el de 10 días hábiles antes del vencimiento, y el
 * que ya tiene devengado a la liquidación es el de 10 hábiles antes de ella
 * (es contra ése que cerv2 calcula la TIR real). Entre uno y otro:
 *
 *     CER(vto−10h) / CER(liq−10h)  =  γ · δ
 *     γ = CER(último publicado) / CER(liq−10h)     ya publicado: es dato
 *     δ = CER(vto−10h) / CER(último publicado)     lo que falta: la incógnita
 *
 * y Fisher se cumple sobre el factor entero: (1+i)^t = (1+ρ)^t · γ · δ, así que
 * δ = (1 + acumulada del par) / γ. El BCRA publica el CER hacia adelante hasta
 * el 15 del mes siguiente, así que γ suele cubrir un mes o más; sin descontarlo
 * el primer par mezcla dato con expectativa y sale aguado.
 *
 * BLOQUES DE IPC
 * El CER no capitaliza a tasa continua: el IPC del mes M rige del 16 de M+1 al
 * 15 de M+2, a tasa diaria constante (1 + π_M)^(1/n). Entonces δ se descompone
 * en los bloques que cruza, cada uno con la fracción de días que le toca, y la
 * inflación implícita se despeja POR MES DE IPC y no por tramo de calendario.
 * Como los vencimientos caen a fin de mes y el CER final es 10 hábiles antes,
 * cada par cae casi exacto sobre un bloque: el par de noviembre despeja el IPC
 * de septiembre, y así.
 *
 * BOOTSTRAP
 * Los pares van en orden de CER final. Cada uno descuenta de su δ los bloques
 * que ya fijó un par anterior, y lo que queda despeja el IPC de los bloques
 * nuevos (uno solo, o el promedio de varios cuando no hay par intermedio). Un
 * par cuyos bloques nuevos suman pocos días (S30O6 con el CER publicado hasta
 * la víspera de su CER final) despeja un mes entero de un día de CER: se
 * muestra como "escaso" y NO fija sus bloques, para no contagiar el ruido al
 * par siguiente.
 *
 * LOS CER CON `cer_fixed` NO ENTRAN
 * A diez hábiles del vencimiento el CER del pago final ya está publicado y el
 * bono es un cupón cero nominal: su TIR "real" es una nominal disfrazada.
 *
 * Todas las tasas son efectivas anuales (base 365), como las deja el XIRR de
 * los motores. TEM = (1 + TEA)^(1/12) − 1.
 */

export type BonoBe = {
  symbol: string
  /** "YYYY-MM-DD" */
  vto: string
  /** Duration de Macaulay en años. Para un bullet, años de la liquidación al vencimiento. */
  dur: number
  /** TEA. Nominal para fija, real para CER. */
  ytm: number
  /** Sólo CER: fecha del CER que indexa el pago final, vto − 10 hábiles. "YYYY-MM-DD". */
  cerFinal?: string
}

export type Par = { fija: BonoBe; cer: BonoBe; vto: string; dur: number; cerFinal: Date }

const DIA_MS = 86400000

export const tem = (tea: number) => Math.pow(1 + tea, 1 / 12) - 1

/** (1 + nominal) / (1 + real) − 1, en TEA. */
export const breakeven = (nominal: number, real: number) => (1 + nominal) / (1 + real) - 1

/** Breakeven llevado al plazo: inflación acumulada de la liquidación al vencimiento. */
export const acumulada = (beTea: number, dur: number) => Math.pow(1 + beTea, dur) - 1

export const fechaUtc = (iso: string) => new Date(`${iso}T00:00:00Z`)
export const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Fijas y CER con el mismo vencimiento, ordenados por vencimiento. */
export function emparejar(fija: BonoBe[], cer: BonoBe[]): Par[] {
  const cerPorVto = new Map(cer.map((c) => [c.vto, c]))
  return fija
    .map((f) => {
      const c = cerPorVto.get(f.vto)
      return c && c.cerFinal ? { fija: f, cer: c, vto: f.vto, dur: f.dur, cerFinal: fechaUtc(c.cerFinal) } : null
    })
    .filter((p): p is Par => p !== null)
    .sort((a, b) => a.cerFinal.getTime() - b.cerFinal.getTime())
}

export type PuntoCer = { fecha: string; valor: number }

export type CerConocido = {
  /** CER de liq − 10h: el que ya está adentro de la TIR real. */
  desde: Date
  /** Último CER publicado. */
  hasta: Date
  /** γ = CER(hasta) / CER(desde). */
  gamma: number
}

/**
 * γ: cuánto CER ya publicado hay desde el que devengó el bono a la liquidación
 * (liq − 10h) hasta el último dato. Si la serie no llega a esa fecha no se
 * puede separar dato de expectativa y se devuelve null.
 */
export function cerConocido(serie: PuntoCer[], cerAplicable: Date): CerConocido | null {
  if (!serie.length) return null
  const apl = iso(cerAplicable)
  // La serie es diaria, pero por si falta un día se toma el último dato ≤ fecha.
  let enApl: PuntoCer | null = null
  for (const p of serie) if (p.fecha <= apl) enApl = p
  const ultimo = serie[serie.length - 1]
  if (!enApl || ultimo.fecha <= apl) return null
  return { desde: cerAplicable, hasta: fechaUtc(ultimo.fecha), gamma: ultimo.valor / enApl.valor }
}

// ── Bloques de IPC ────────────────────────────────────────────────────────────

export type Bloque = {
  /** Mes de IPC, "YYYY-MM". */
  mes: string
  /** Días del bloque (del 16 de M+1 al 15 de M+2). */
  dias: number
}

/**
 * Bloque al que pertenece el paso del CER hacia la fecha `d`: el IPC de M rige
 * los días 16/M+1 … 15/M+2 inclusive.
 */
export function bloqueDe(d: Date): Bloque {
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), dia = d.getUTCDate()
  // Mes cuyo día 16 abre el bloque (M+1).
  const apertura = dia >= 16 ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y, m - 1, 1))
  const ipc = new Date(Date.UTC(apertura.getUTCFullYear(), apertura.getUTCMonth() - 1, 1))
  const cierre = new Date(Date.UTC(apertura.getUTCFullYear(), apertura.getUTCMonth() + 1, 1))
  return { mes: claveMes(ipc), dias: (cierre.getTime() - apertura.getTime()) / DIA_MS }
}

export type Tramo = Bloque & {
  /** Días de este bloque que caen en (desde, hasta]. */
  enTramo: number
}

/** Bloques que cruza el CER entre dos fechas: los pasos de desde+1 a hasta. */
export function bloquesEntre(desde: Date, hasta: Date): Tramo[] {
  const out: Tramo[] = []
  const d = new Date(desde.getTime() + DIA_MS)
  while (d <= hasta) {
    const b = bloqueDe(d)
    const last = out[out.length - 1]
    if (last && last.mes === b.mes) last.enTramo++
    else out.push({ ...b, enTramo: 1 })
    d.setTime(d.getTime() + DIA_MS)
  }
  return out
}

/** Meses de IPC equivalentes: Σ días / días del bloque. */
export const mesesDe = (tramos: Tramo[]) => tramos.reduce((s, t) => s + t.enTramo / t.dias, 0)

/** Factor de CER que producen `tramos` a las tasas de `pi` (por mes de IPC). */
export function factorDe(tramos: Tramo[], pi: Map<string, number>): number | null {
  let f = 1
  for (const t of tramos) {
    const v = pi.get(t.mes)
    if (v == null) return null
    f *= Math.pow(1 + v, t.enTramo / t.dias)
  }
  return f
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Menos días de CER que esto y el mes despejado es ruido de precio: el par no
 * lo fija para los siguientes. También vale bloque por bloque: un par que cruza
 * dic, ene, feb y un día de marzo promedia los cuatro, pero marzo queda libre
 * para el par que lo cubra de verdad.
 */
export const DIAS_MINIMOS = 7

/** Bloques con días suficientes para decir algo; si ninguno llega, todos. */
export const significativos = (tramos: Tramo[]) => {
  const sig = tramos.filter((t) => t.enTramo >= DIAS_MINIMOS)
  return sig.length ? sig : tramos
}

export type Fila = {
  par: Par
  be: number
  /** Inflación acumulada liq → vto que descuenta el par. */
  acum: number
  /** CER ya publicado desde liq − 10h, como factor. */
  gamma: number
  /** CER que falta, desde el último publicado hasta el CER final del par. */
  delta: number
  /** Bloques que cruza δ: fijados por un par anterior o nuevos de este par. */
  fijados: Tramo[]
  nuevos: Tramo[]
  /** Días de CER que aportan los bloques nuevos. */
  diasNuevos: number
  /** IPC mensual implícito de los bloques nuevos (uno, o el promedio de varios). */
  implicita: number | null
  /** true si diasNuevos < DIAS_MINIMOS: se muestra pero no fija sus bloques. */
  /* (los bloques nuevos con menos de DIAS_MINIMOS días tampoco se fijan, aunque la fila no sea escasa) */
  escasa: boolean
  /** true si el CER final ya está publicado: no hay nada que despejar. */
  determinado: boolean
}

export function bootstrap(pares: Par[], cer: CerConocido | null): Fila[] {
  const pi = new Map<string, number>()
  const out: Fila[] = []
  for (const p of pares) {
    const be = breakeven(p.fija.ytm, p.cer.ytm)
    const acum = acumulada(be, p.dur)
    const gamma = cer?.gamma ?? 1
    const delta = (1 + acum) / gamma
    const inicio = cer?.hasta ?? cer?.desde ?? null
    const determinado = inicio != null && p.cerFinal <= inicio
    const tramos = inicio && !determinado ? bloquesEntre(inicio, p.cerFinal) : []
    const fijados = tramos.filter((t) => pi.has(t.mes))
    const nuevos = tramos.filter((t) => !pi.has(t.mes))
    const diasNuevos = nuevos.reduce((s, t) => s + t.enTramo, 0)
    const meses = mesesDe(nuevos)
    const resto = delta / (factorDe(fijados, pi) ?? 1)
    const implicita = meses > 0 && resto > 0 ? Math.pow(resto, 1 / meses) - 1 : null
    const escasa = !determinado && diasNuevos < DIAS_MINIMOS
    if (implicita != null && !escasa) for (const t of nuevos) if (t.enTramo >= DIAS_MINIMOS) pi.set(t.mes, implicita)
    out.push({ par: p, be, acum, gamma, delta, fijados, nuevos, diasNuevos, implicita, escasa, determinado })
  }
  return out
}

// ── Senda del REM ─────────────────────────────────────────────────────────────

export type MesPct = { mes: string; valor: number }   // mes "YYYY-MM", valor en % mensual
export type AnioPct = { anio: number; valor: number } // var. i.a. a diciembre, en %

/**
 * Inflación mensual esperada mes a mes, para comparar con el breakeven.
 *
 * Los meses ya publicados por el INDEC (`observado`) pisan al REM: no es una
 * expectativa, es dato. Después van las medianas mensuales del REM, que cubren
 * unos seis meses. Más allá, el REM sólo da la variación anual a diciembre: se
 * reparte en los meses del año que faltan, calibrada para que el acumulado del
 * año cierre en esa cifra. Pasado el último año con dato, se repite el último
 * mensual: no hay nada mejor y es preferible a cortar la senda.
 *
 * Devuelve un mapa "YYYY-MM" → tasa mensual (fracción, no %) hasta `hastaMes`.
 */
export function sendaRem(
  observado: MesPct[],
  mensual: MesPct[],
  anual: AnioPct[],
  hastaMes: string,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of mensual) out.set(m.mes, m.valor / 100)
  for (const m of observado) out.set(m.mes, m.valor / 100)
  if (!out.size) return out

  const meses = [...out.keys()].sort()
  let cursor = meses[meses.length - 1]
  let ultimo = out.get(cursor)!
  const anualDe = new Map(anual.map((a) => [a.anio, a.valor / 100]))

  while (cursor < hastaMes) {
    cursor = mesSiguiente(cursor)
    const anio = Number(cursor.slice(0, 4))
    const objetivo = anualDe.get(anio)
    if (objetivo != null) {
      let acumulado = 1
      let faltan = 0
      for (let m = 1; m <= 12; m++) {
        const k = `${anio}-${String(m).padStart(2, "0")}`
        const v = out.get(k)
        if (v != null) acumulado *= 1 + v
        else if (k >= cursor) faltan++
      }
      if (faltan > 0) {
        const mensualRestante = Math.pow((1 + objetivo) / acumulado, 1 / faltan) - 1
        for (let m = 1; m <= 12; m++) {
          const k = `${anio}-${String(m).padStart(2, "0")}`
          if (!out.has(k) && k >= cursor) out.set(k, mensualRestante)
        }
        ultimo = mensualRestante
        cursor = `${anio}-12`
        continue
      }
    }
    out.set(cursor, ultimo)
  }
  return out
}

function mesSiguiente(m: string): string {
  const [y, mm] = m.split("-").map(Number)
  return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`
}

export const claveMes = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`

/**
 * Lo que espera la senda para los mismos bloques, ponderado por la fracción de
 * días de cada uno: mensual equivalente. null si a la senda le falta un mes.
 */
export function remEnBloques(senda: Map<string, number>, tramos: Tramo[]): number | null {
  const meses = mesesDe(tramos)
  if (!meses) return null
  const f = factorDe(tramos, senda)
  return f == null ? null : Math.pow(f, 1 / meses) - 1
}
