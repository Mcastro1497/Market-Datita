/**
 * Breakevens CER / tasa fija.
 *
 * QUÉ ES
 * Un bono fija rinde una TIR nominal en pesos; un CER, una TIR real. La
 * inflación que iguala las dos es el breakeven: (1 + nominal) / (1 + real) − 1
 * en TEA, o llevado al plazo del bono, la inflación ACUMULADA que tiene que
 * haber entre la liquidación y el vencimiento para que dé lo mismo comprar uno
 * u otro. Por encima gana el CER, por debajo la fija.
 *
 * SÓLO PARES
 * Se compara únicamente cuando el Tesoro emitió una fija y un CER al MISMO
 * vencimiento (S30O6 / TZXO6). Interpolar la curva CER a la duration de una
 * fija sin par mete el error de la interpolación adentro de un número que se
 * lee en centésimas de punto mensual; no vale la pena.
 *
 * TRAMOS
 * Si el par de octubre descuenta 2% acumulado y el de noviembre 4%, la
 * inflación implícita entre octubre y noviembre es 1,04 / 1,02 − 1 = 1,96%.
 * Es la misma cuenta que una forward de tasas, sobre acumulados en vez de
 * TIRs: cada tramo va del vencimiento del par anterior al de éste, y el
 * primero arranca en la liquidación.
 *
 * REZAGO DEL CER
 * El CER de un día refleja el IPC de unos 45 días antes: el índice de
 * septiembre se publica a mediados de octubre y rige del 16 de octubre al 15
 * de noviembre. Lo que capitaliza un CER que vence el 30 de noviembre no es la
 * inflación hasta noviembre sino hasta mediados de octubre. Por eso cada tramo
 * se etiqueta con la ventana corrida (liq − 45 → vto − 45), y el REM se
 * compara sobre esa ventana, no sobre el calendario del bono.
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
  /** Duration de Macaulay en años. Para un bullet, años hasta el vencimiento. */
  dur: number
  /** TEA. Nominal para fija, real para CER. */
  ytm: number
}

export type Par = { fija: BonoBe; cer: BonoBe; vto: string; dur: number }

export const REZAGO_CER_DIAS = 45
const DIA_MS = 86400000

export const tem = (tea: number) => Math.pow(1 + tea, 1 / 12) - 1

/** (1 + nominal) / (1 + real) − 1, en TEA. */
export const breakeven = (nominal: number, real: number) => (1 + nominal) / (1 + real) - 1

/** Breakeven llevado al plazo: inflación acumulada de la liquidación al vencimiento. */
export const acumulada = (beTea: number, dur: number) => Math.pow(1 + beTea, dur) - 1

/** Acumulado de un tramo → mensual equivalente, con el tramo medido en años. */
export const mensualDe = (acum: number, anios: number) =>
  anios > 0 ? Math.pow(1 + acum, 1 / (anios * 12)) - 1 : null

/** Fijas y CER con el mismo vencimiento, ordenados por vencimiento. */
export function emparejar(fija: BonoBe[], cer: BonoBe[]): Par[] {
  const cerPorVto = new Map(cer.map((c) => [c.vto, c]))
  return fija
    .map((f) => {
      const c = cerPorVto.get(f.vto)
      return c ? { fija: f, cer: c, vto: f.vto, dur: f.dur } : null
    })
    .filter((p): p is Par => p !== null)
    .sort((a, b) => a.vto.localeCompare(b.vto))
}

export type Tramo = {
  par: Par
  be: number
  /** Inflación acumulada liq → vto que descuenta el par. */
  acum: number
  /** Inflación del tramo: (1 + acum) / (1 + acum del par anterior) − 1. */
  tramo: number
  tramoMensual: number | null
  /** Años del tramo. */
  anios: number
  desde: Par | null
  /** Ventana de inflación que cubre el tramo, corrida por el rezago del CER. */
  ventana: { desde: Date; hasta: Date }
}

export function tramos(pares: Par[], liquidacion: Date): Tramo[] {
  const out: Tramo[] = []
  let acumPrev = 0
  let durPrev = 0
  let parPrev: Par | null = null
  for (const p of pares) {
    const be = breakeven(p.fija.ytm, p.cer.ytm)
    const acum = acumulada(be, p.dur)
    const tramo = (1 + acum) / (1 + acumPrev) - 1
    const anios = p.dur - durPrev
    const d0 = parPrev ? fechaUtc(parPrev.vto) : liquidacion
    out.push({
      par: p, be, acum, tramo, anios,
      tramoMensual: mensualDe(tramo, anios),
      desde: parPrev,
      ventana: {
        desde: new Date(d0.getTime() - REZAGO_CER_DIAS * DIA_MS),
        hasta: new Date(fechaUtc(p.vto).getTime() - REZAGO_CER_DIAS * DIA_MS),
      },
    })
    acumPrev = acum
    durPrev = p.dur
    parPrev = p
  }
  return out
}

export const fechaUtc = (iso: string) => new Date(`${iso}T00:00:00Z`)

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
 * Inflación que espera la senda en una ventana ya corrida por el rezago:
 * acumulada y mensual equivalente. Cada mes pesa por la fracción de sus días
 * que cae en la ventana. null si a la senda le falta algún mes.
 */
export function remEnVentana(
  senda: Map<string, number>,
  desde: Date,
  hasta: Date,
): { acum: number; mensual: number } | null {
  if (!(hasta > desde)) return null
  let logAcum = 0
  let meses = 0
  const cur = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1))
  while (cur < hasta) {
    const fin = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
    const diasMes = (fin.getTime() - cur.getTime()) / DIA_MS
    const ini = Math.max(cur.getTime(), desde.getTime())
    const end = Math.min(fin.getTime(), hasta.getTime())
    const enVentana = (end - ini) / DIA_MS
    if (enVentana > 0) {
      const v = senda.get(claveMes(cur))
      if (v == null) return null
      logAcum += Math.log(1 + v) * (enVentana / diasMes)
      meses += enVentana / diasMes
    }
    cur.setTime(fin.getTime())
  }
  if (!meses) return null
  return { acum: Math.exp(logAcum) - 1, mensual: Math.exp(logAcum / meses) - 1 }
}
