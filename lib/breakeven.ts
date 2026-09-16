/**
 * Breakevens CER / tasa fija.
 *
 * QUÉ ES
 * Un bono fija rinde una TIR nominal en pesos; un CER, una TIR real. La
 * inflación que iguala las dos es el breakeven: (1 + nominal) / (1 + real) − 1.
 * Por encima de esa inflación gana el CER, por debajo gana la fija. Se lee en
 * mensual (TEM) porque así se cotiza en la mesa y así lo publica el INDEC.
 *
 * DE DÓNDE SALE LA TIR REAL
 * Del par exacto cuando el Tesoro emitió una fija y un CER al mismo vencimiento
 * (S30O6 / TZXO6). Si no hay par, se interpola linealmente la curva CER por
 * duration. Antes del primer CER o después del último no se extrapola: se toma
 * el CER más cercano y la fila queda marcada, para que no se lea como dato.
 *
 * LOS CER CON `cer_fixed` NO ENTRAN
 * A diez hábiles del vencimiento el CER del pago final ya está publicado y el
 * bono es un cupón cero nominal: su TIR "real" es una nominal disfrazada y el
 * breakeven contra una fija da un número sin sentido (medio punto anual).
 *
 * TODAS LAS TASAS SON EFECTIVAS ANUALES (base 365), como las deja el XIRR de los
 * motores. TEM = (1 + TEA)^(1/12) − 1.
 */

export type BonoBe = {
  symbol: string
  /** "YYYY-MM-DD" */
  vto: string
  /** Duration de Macaulay en años. Es el eje sobre el que se interpola. */
  dur: number
  /** TEA. Nominal para fija, real para CER. */
  ytm: number
}

export type ModoReal = "par" | "interp" | "borde"

export type RealDeCurva = {
  ytm: number
  modo: ModoReal
  /** Qué CER lo explica: "TZXO6" o "TZXO6–TX26". */
  ref: string
}

export const tem = (tea: number) => Math.pow(1 + tea, 1 / 12) - 1
export const tea = (tem: number) => Math.pow(1 + tem, 12) - 1

/** (1 + nominal) / (1 + real) − 1, en TEA. */
export const breakeven = (nominal: number, real: number) => (1 + nominal) / (1 + real) - 1

/**
 * TIR real a la duration `dur`, o del par exacto por vencimiento si existe.
 * `cer` viene ordenado por duration ascendente y sin los `cer_fixed`.
 */
export function realEn(cer: BonoBe[], dur: number, vto: string): RealDeCurva | null {
  if (!cer.length) return null
  const par = cer.find((c) => c.vto === vto)
  if (par) return { ytm: par.ytm, modo: "par", ref: par.symbol }
  const first = cer[0], last = cer[cer.length - 1]
  if (dur <= first.dur) return { ytm: first.ytm, modo: "borde", ref: first.symbol }
  if (dur >= last.dur) return { ytm: last.ytm, modo: "borde", ref: last.symbol }
  for (let i = 1; i < cer.length; i++) {
    const a = cer[i - 1], b = cer[i]
    if (dur <= b.dur) {
      const w = (dur - a.dur) / (b.dur - a.dur || 1)
      return { ytm: a.ytm + w * (b.ytm - a.ytm), modo: "interp", ref: `${a.symbol}–${b.symbol}` }
    }
  }
  return { ytm: last.ytm, modo: "borde", ref: last.symbol }
}

/**
 * Inflación implícita entre dos horizontes: la que hay que tener entre t1 y t2
 * para que el breakeven a t2 sea consistente con el de t1. Es la misma cuenta
 * que la forward de tasas, sobre breakevens en vez de TIRs.
 * F(1,2) = [ (1+B2)^t2 / (1+B1)^t1 ] ^ ( 1/(t2−t1) ) − 1
 */
export function forwardBe(b1: number, t1: number, b2: number, t2: number): number | null {
  if (!(t2 > t1)) return null
  return Math.pow(Math.pow(1 + b2, t2) / Math.pow(1 + b1, t1), 1 / (t2 - t1)) - 1
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
      // Meses del año ya en la senda y los que faltan cubrir hasta diciembre.
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

/**
 * Inflación mensual equivalente que espera la senda entre dos fechas, con la
 * ventana corrida `rezagoDias` para atrás. Cada mes pesa por la fracción de sus
 * días que cae en la ventana.
 *
 * POR QUÉ EL REZAGO
 * El CER de un día refleja el IPC de dos meses antes (el índice de marzo se
 * publica a mediados de abril y rige del 16 de abril al 15 de mayo). Lo que
 * capitaliza un bono CER entre la liquidación y el vencimiento no es la
 * inflación de ese lapso sino la de ~45 días antes. Comparar el breakeven con
 * el REM del mismo calendario que el bono lo desfasa un mes y medio, y en el
 * tramo corto eso es todo el dato.
 */
export function remEntre(
  senda: Map<string, number>,
  desde: Date,
  hasta: Date,
  rezagoDias = 45,
): number | null {
  const d0 = new Date(desde.getTime() - rezagoDias * 86400000)
  const d1 = new Date(hasta.getTime() - rezagoDias * 86400000)
  if (!(d1 > d0)) return null
  let logAcum = 0
  let meses = 0
  const cur = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1))
  while (cur < d1) {
    const fin = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
    const diasMes = (fin.getTime() - cur.getTime()) / 86400000
    const ini = Math.max(cur.getTime(), d0.getTime())
    const end = Math.min(fin.getTime(), d1.getTime())
    const enVentana = (end - ini) / 86400000
    if (enVentana > 0) {
      const k = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`
      const v = senda.get(k)
      if (v == null) return null
      logAcum += Math.log(1 + v) * (enVentana / diasMes)
      meses += enVentana / diasMes
    }
    cur.setTime(fin.getTime())
  }
  if (!meses) return null
  // Acumulado de la ventana llevado a mensual equivalente. Se cuenta en meses
  // calendario y no en días/30,4 para que un mes entero devuelva su propia tasa.
  return Math.exp(logAcum / meses) - 1
}
