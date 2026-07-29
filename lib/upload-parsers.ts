import * as XLSX from "xlsx"

// ============================================================================
//  Parser de los Excel CRUDOS del terminal (basado en load.py).
//  - Doble encabezado: fila 0 = grupo, fila 1 = nombre real -> datos desde fila 2
//  - Flujos: se toma la BASE sin ajustar de las columnas "Interés (vn)" y
//    "Amortización (vn)". Para bonos CER el bloque "c/100 vn" viene con el
//    coeficiente de ajuste aplicado; las columnas "(vn)" no lo tienen.
// ============================================================================

// ---------- parsers de valores (equivalentes a load.py) ----------
const isNA = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === ""

export function pText(v: unknown): string | null {
  if (isNA(v)) return null
  return String(v).trim()
}

export function pNum(v: unknown): number | null {
  if (isNA(v)) return null
  const n = Number(String(v).trim().replace(/,/g, ""))
  return isNaN(n) ? null : n
}

export function pInt(v: unknown): number | null {
  const n = pNum(v)
  return n === null ? null : Math.trunc(n)
}

// Valores "por 100 VN" que el terminal formatea con % pero son número plano,
// NO una fracción: "20.00%" = 20 por cada 100 VN (no 0.20), "4.25%" = 4.25.
// Saca el % SIN dividir por 100.
export function pBaseVn(v: unknown): number | null {
  if (isNA(v)) return null
  return pNum(String(v).trim().replace(/%$/, ""))
}

// "8.50%" -> 0.085 ; "100.00%" -> 1 ; "2.75" -> 2.75  (redondeo a 8 decimales)
export function pPct(v: unknown): number | null {
  if (isNA(v)) return null
  const s = String(v).trim()
  const raw = s.endsWith("%") ? s.slice(0, -1) : s
  const n = Number(raw.replace(/,/g, ""))
  if (isNaN(n)) return null
  const val = s.endsWith("%") ? n / 100 : n
  return Math.round(val * 1e8) / 1e8
}

export function pDate(v: unknown): string | null {
  if (isNA(v)) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10)
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400 * 1000) // serial Excel
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)          // ISO
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)       // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export function pBool(v: unknown): boolean {
  if (isNA(v)) return false
  const s = String(v).toLowerCase().trim()
  return ["sí", "si", "yes", "true", "verdadero", "1"].includes(s)
}

// ---------- lectura del archivo a grilla (array de arrays) ----------
function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // BOM
  const rows: string[][] = []
  let row: string[] = [], field = "", inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else field += c
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row) }
  return rows
}

export async function readGrid(file: File): Promise<unknown[][]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCSV(await file.text())
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: "buffer", cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][]
}

function headerIndex(headerRow: unknown[]): Map<string, number> {
  const m = new Map<string, number>()
  headerRow.forEach((h, i) => {
    const k = String(h ?? "").trim()
    if (k && !m.has(k)) m.set(k, i) // primera aparición (bloque c/100 va antes que el total)
  })
  return m
}

// ---------- FLUJOS (calendario-de-pagos) -> instrument_flows_test ----------
export interface FlowRow {
  symbol: string
  fecha_pago: string
  interes: number | null
  amortizacion: number | null
  total: number | null
  moneda_pago: string | null
  dias: number | null
  cupon: number | null
  valor_residual: number | null
}

export function parseFlows(grid: unknown[][]): {
  rows: FlowRow[]; skipped: number; discardedAt: string[]
} {
  const H = headerIndex(grid[1] ?? [])
  const at = (row: unknown[], name: string) => {
    const i = H.get(name); return i === undefined ? "" : row[i]
  }
  const rows: FlowRow[] = [], discardedAt: string[] = []
  let skipped = 0
  for (let r = 2; r < grid.length; r++) {
    const row = grid[r]
    if (!row || !row.length) continue
    const symbol = pText(at(row, "Ticker"))
    if (!symbol) { skipped++; continue }
    if (symbol.includes("@")) { discardedAt.push(symbol); continue } // valuaciones 1816
    const fecha = pDate(at(row, "Efectiva"))
    if (!fecha) { skipped++; continue }
    // Base SIN ajustar: para CER el bloque "c/100 vn" trae el coeficiente
    // aplicado; usamos las columnas "(vn)" que el terminal ya da sin ajuste.
    const interes = pBaseVn(at(row, "Interés (vn)"))
    const amortizacion = pBaseVn(at(row, "Amortización (vn)"))
    const total = interes === null && amortizacion === null
      ? null : Math.round(((interes ?? 0) + (amortizacion ?? 0)) * 1e8) / 1e8
    rows.push({
      symbol,
      fecha_pago: fecha,
      interes,
      amortizacion,
      total,
      moneda_pago: pText(at(row, "Mon. pago")),
      dias: pInt(at(row, "Días")),
      cupon: pPct(at(row, "Tasa de int.")),
      valor_residual: pPct(at(row, "Valor residual")),
    })
  }
  return { rows, skipped, discardedAt }
}

// ---------- INSTRUMENTOS (screener) -> instruments_test ----------
function classifyType(x: {
  tipo_activo: string | null; moneda_denom: string | null; moneda_pago: string | null
  tipo_cupon: string | null; tasa_ref: string | null; referencias: string | null
}): string {
  if (x.tipo_activo === "Corporativos") return "ON"
  const ref = (x.referencias || "").toUpperCase()
  const cup = (x.tipo_cupon || "").toUpperCase()
  const tref = (x.tasa_ref || "").toUpperCase()
  if (tref.includes("TAMAR") || ref.includes("TAMAR")) return "TAMAR"
  if (cup.includes("CER") || ref.includes("CER")) return "CER"
  if (ref.includes("DLK") || ref.includes("DOLAR") || ref.includes("DÓLAR") ||
      (x.moneda_denom === "ARS" && x.moneda_pago === "USD")) return "DLK"
  if (x.moneda_denom === "USD") return "HD"
  return "FIJA"
}

export function parseInstruments(grid: unknown[][]): {
  rows: Record<string, unknown>[]; skipped: number
} {
  const H = headerIndex(grid[1] ?? [])
  const at = (row: unknown[], name: string) => {
    const i = H.get(name); return i === undefined ? "" : row[i]
  }
  const rows: Record<string, unknown>[] = []
  let skipped = 0
  for (let r = 2; r < grid.length; r++) {
    const row = grid[r]
    if (!row || !row.length) continue
    const symbol = pText(at(row, "Ticker"))
    if (!symbol || symbol.includes("@")) { skipped++; continue }

    const tipo_activo = pText(at(row, "Tipo activo"))
    const moneda_denom = pText(at(row, "Moneda denom."))
    const moneda_pago = pText(at(row, "Moneda pago"))
    const tipo_cupon = pText(at(row, "Tipo cupón"))
    const tasa_ref = pText(at(row, "Tasa ref."))
    const referencias = pText(at(row, "Referencias"))

    rows.push({
      symbol,
      instrument_type: classifyType({
        tipo_activo, moneda_denom, moneda_pago, tipo_cupon, tasa_ref, referencias,
      }),
      segment: "24hs",
      is_active: true,
      emisor: pText(at(row, "Emisor")),
      legislacion: pText(at(row, "Legislación")),
      jurisdiccion_pago: pText(at(row, "Jurisdicción pago")),
      emision: pDate(at(row, "Emisión")),
      vencimiento: pDate(at(row, "Vencimiento")),
      denominacion: pText(at(row, "Denominación")),
      tipo_activo,
      clase: pText(at(row, "Clase")),
      serie: pText(at(row, "Serie")),
      isin: pText(at(row, "ISIN")),
      convencion_int: pText(at(row, "Convención int.")),
      moneda_denom,
      moneda_pago,
      periodicidad_int: pText(at(row, "Periodicidad int.")),
      tipo_cupon,
      tasa_int: pPct(at(row, "Tasa int.")),
      margen_ref: pText(at(row, "Margen ref.")),
      tasa_ref,
      lamina_min: pNum(at(row, "Lámina mín.")),
      operacion_min: pNum(at(row, "Operación mín.")),
      vn_vigente: pNum(at(row, "VN vigente")),
      vr_vigente: pNum(at(row, "VR vigente")),
      valor_residual: pPct(at(row, "Valor Residual")),
      callable: pBool(at(row, "Callable")),
      referencias,
    })
  }
  return { rows, skipped }
}
