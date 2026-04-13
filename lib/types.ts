export interface ONFlow {
  id: string
  fecha_pago: string
  emisor: string
  ticker: string
  interes: number
  amortizacion: number
  total: number
  moneda_pago: string
  moneda_denominacion: string
  dias: number
  cupon: number
  valor_residual: number
  created_at: string
  updated_at: string
}

export interface ONDetails {
  id: string
  ticker: string
  fecha_vencimiento: string | null
  legislacion: string | null
  jurisdiccion_pago: string | null
  lamina_minima: number | null
  calleable: boolean
  monto_residual: number | null
  created_at: string
  updated_at: string
}

export interface LastPrice {
  symbol: string
  price_usd: number | null
  ytm: number | null
  duration_y: number | null
  price_ars: number | null
  bid: number | null
  ask: number | null
  fx_mep: number | null
  last: number | null
  change: number | null
  closing_price: number | null
  ts: string | null
}

export interface ONWithDetails extends ONFlow {
  details?: ONDetails
  lastPrice?: LastPrice
}

export interface SoberanoFlow {
  id: string
  fecha_pago: string
  emisor: string
  ticker: string
  interes: number
  amortizacion: number
  total: number
  moneda_pago: string
  moneda_denominacion: string
  dias: number
  cupon: number
  valor_residual: number
  created_at: string
  updated_at: string
}

export interface SoberanoDetails {
  id: string
  ticker: string
  fecha_vencimiento: string | null
  legislacion: string | null
  jurisdiccion_pago: string | null
  lamina_minima: number | null
  calleable: boolean
  monto_residual: number | null
  created_at: string
  updated_at: string
}

export interface SoberanoWithDetails extends SoberanoFlow {
  details?: SoberanoDetails
  lastPrice?: LastPrice
}

export interface ExcelRow {
  "Fecha de pago": string
  Emisor: string
  Ticker: string
  Interés: number
  Amortización: number
  Total: number
  "Mon. pago": string
  "Mon. denom. Base": string
  Días: number
  Cupón: number
  "Valor residual": number
}

export interface ExcelSoberanoRow {
  "Fecha de pago": string
  Emisor: string
  Ticker: string
  Interés: number
  Amortización: number
  Total: number
  "Mon. pago": string
  "Mon. denom. Base": string
  Días: number
  Cupón: number
  "Valor residual": number
}

export interface ExcelSoberanoArsRow {
  "Fecha de pago": string
  Emisor: string
  Ticker: string
  Interés: number
  Amortización: number
  Total: number
  "Mon. pago": string
  "Mon. denom. Base": string
  Días: number
  Cupón: number
  "Valor residual": number
}

export interface AllTicker {
  ticker: string
  tipo_activo: "Obligacion Negociable" | "Soberanos Hard Dollar" | "Soberanos ARS" // Added Soberanos ARS to the union type
  fecha_vencimiento: string | null
  monto_residual: number | null
  calleable: boolean
  legislacion: string | null
  jurisdiccion_pago: string | null
  lamina_minima: number | null
  sector: string | null
  rating: string | null
  moneda: string | null
  created_at: string
  updated_at: string
}

export interface CerHistorico {
  id: string
  fecha: string
  valor_cer: number
  created_at: string
  updated_at: string
}

export interface ExcelCerRow {
  fecha: string
  valor_cer: number
}
