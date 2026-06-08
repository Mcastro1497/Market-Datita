// ── Nuevo schema unificado ────────────────────────────────

export interface Instrument {
  symbol:            string
  instrument_type:   "ON" | "HD" | "ARS" | "DLK" | "FX"
  segment:           string
  is_active:         boolean
  emisor:            string | null
  legislacion:       string | null
  jurisdiccion_pago: string | null
  vencimiento:       string | null
  emision:           string | null
  lamina_min:        number | null
  vr_vigente:        number | null
  callable:          boolean | null
  moneda_denom:      string | null
  tipo_cupon:        string | null
  cer_emision:       number | null
  tasa_int:          number | null
  // ── Columnas nuevas en instruments_v2 ──
  moneda_pago:       string | null
  denominacion:      string | null
  tipo_activo:       string | null
  clase:             string | null
  serie:             string | null
  isin:              string | null
  convencion_int:    string | null
  periodicidad_int:  string | null
  margen_ref:        number | null
  tasa_ref:          number | null
  operacion_min:     number | null
  vn_vigente:        number | null
  valor_residual:    number | null
  referencias:       string | null
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
    vencimiento:       string | null
    legislacion:       string | null
    jurisdiccion_pago: string | null
    lamina_min:        number | null
    callable:          boolean | null
    vr_vigente:        number | null
    moneda_pago:       string | null
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
    vencimiento:       string | null
    legislacion:       string | null
    jurisdiccion_pago: string | null
    lamina_min:        number | null
    callable:          boolean | null
    vr_vigente:        number | null
    moneda_denom:      string | null
    moneda_pago:       string | null
    tipo_cupon:        string | null
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
    tamar_obs:     number | null
    tamar_proy:    number | null
    tem_obs:       number | null
    tem_proy:      number | null
    tem_ponderada: number | null
    tem_margen:    number | null
    tem_total:     number | null
    vpv:           number | null
    paridad:       number | null
    bid:           number | null
    ask:           number | null
    closing_price: number | null
    ts:            string | null
  } | null
}

// ── DLK: igual a Soberano pero con `price_ars` separado de `price_usd` ──
// price_ars: lo que cotiza en pesos (= prices.last)
// price_usd: precio_ars / fx_oficial (calculado en runtime, en USD eq.)
export type DlkWithDetails = {
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
    vencimiento:       string | null
    legislacion:       string | null
    jurisdiccion_pago: string | null
    lamina_min:        number | null
    callable:          boolean | null
    vr_vigente:        number | null
    moneda_denom:      string | null
    moneda_pago:       string | null
    tipo_cupon:        string | null
    cer_emision:       number | null
  } | null
  lastPrice?: {
    symbol:        string
    last:          number | null
    change_pct:    number | null
    change:        number | null
    price_ars:     number | null    // = last (cotiza en ARS)
    price_usd:     number | null    // = last / fx_oficial (calculado)
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
  vencimiento:       string | null
  vr_vigente:        number | null
  callable:          boolean | null
  legislacion:       string | null
  jurisdiccion_pago: string | null
  lamina_min:        number | null
  sector:            string | null
  rating:            string | null
  moneda_denom:      string | null
  created_at:        string
  updated_at:        string
}
