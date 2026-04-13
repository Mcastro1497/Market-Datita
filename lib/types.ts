// ── Nuevo schema unificado ────────────────────────────────

export interface Instrument {
  symbol:            string
  instrument_type:   "ON" | "HD" | "ARS"
  segment:           string
  is_active:         boolean
  emisor:            string | null
  legislacion:       string | null
  jurisdiccion_pago: string | null
  fecha_vencimiento: string | null
  lamina_minima:     number | null
  monto_residual:    number | null
  calleable:         boolean | null
  moneda:            string | null
  tipo:              string | null
  cer_emision:       number | null
  cupon:             number | null
}

export interface InstrumentFlow {
  id:            string
  symbol:        string
  fecha_pago:    string
  interes:       number | null
  amortizacion:  number | null
  total:         number | null
  moneda_pago:   string | null
  dias:          number | null
  cupon:         number | null
  valor_residual:number | null
  tipo:          string | null
}

export interface Price {
  symbol:        string
  last:          number | null
  bid:           number | null
  ask:           number | null
  price_ars:     number | null
  fx_mep:        number | null
  ytm:           number | null
  duration_y:    number | null
  tna:           number | null
  closing_price: number | null
  change_pct:    number | null
  ts:            string | null
}

// ── Tipos combinados para compatibilidad con componentes ──

export type ONWithDetails = {
  id:            string
  ticker:        string
  emisor:        string
  fecha_pago:    string
  interes:       number | null
  amortizacion:  number | null
  total:         number | null
  moneda_pago:   string | null
  dias:          number | null
  cupon:         number | null
  valor_residual:number | null
  details?: {
    ticker:            string
    fecha_vencimiento: string | null
    legislacion:       string | null
    jurisdiccion_pago: string | null
    lamina_minima:     number | null
    calleable:         boolean | null
    monto_residual:    number | null
  } | null
  lastPrice?: {
    symbol:        string
    last:          number | null
    change_pct:    number | null
    change:        number | null   // alias de change_pct
    price_usd:     number | null   // alias de last
    ytm:           number | null
    duration_y:    number | null
    tna:           number | null
    bid:           number | null
    ask:           number | null
    closing_price: number | null
    ts:            string | null
  } | null
}

export type SoberanoWithDetails = {
  id:            string
  ticker:        string
  emisor:        string
  fecha_pago:    string
  interes:       number | null
  amortizacion:  number | null
  total:         number | null
  moneda_pago:   string | null
  dias:          number | null
  cupon:         number | null
  valor_residual:number | null
  details?: {
    ticker:            string
    fecha_vencimiento: string | null
    legislacion:       string | null
    jurisdiccion_pago: string | null
    lamina_minima:     number | null
    calleable:         boolean | null
    monto_residual:    number | null
    moneda:            string | null
    tipo:              string | null
    cer_emision:       number | null
  } | null
  lastPrice?: {
    symbol:        string
    last:          number | null
    change_pct:    number | null
    change:        number | null
    price_usd:     number | null
    ytm:           number | null
    duration_y:    number | null
    tna:           number | null
    bid:           number | null
    ask:           number | null
    closing_price: number | null
    ts:            string | null
  } | null
}

export interface CerHistorico {
  fecha:     string
  valor_cer: number
}

export interface ExcelRow {
  "Fecha de pago": string
  Emisor:          string
  Ticker:          string
  Interés:         number
  Amortización:    number
  Total:           number
  "Mon. pago":     string
  "Mon. denom. Base": string
  Días:            number
  Cupón:           number
  "Valor residual":number
}

// ── Aliases para compatibilidad con componentes que usan tipos viejos ──

export type ONFlow = {
  id:            string
  fecha_pago:    string
  emisor:        string
  ticker:        string
  interes:       number | null
  amortizacion:  number | null
  total:         number | null
  moneda_pago:   string | null
  dias:          number | null
  cupon:         number | null
  valor_residual:number | null
}

export type AllTicker = {
  ticker:            string
  tipo_activo:       string
  fecha_vencimiento: string | null
  monto_residual:    number | null
  calleable:         boolean | null
  legislacion:       string | null
  jurisdiccion_pago: string | null
  lamina_minima:     number | null
  sector:            string | null
  rating:            string | null
  moneda:            string | null
  created_at:        string
  updated_at:        string
}
