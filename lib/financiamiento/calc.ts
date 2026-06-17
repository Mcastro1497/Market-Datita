export interface CalcInputs {
  /** Plazo en días (entero). */
  plazoDias: number;
  /** Monto nominal del eCheq, en pesos. */
  monto: number;
  /** Tasa de descuento, TNA en porcentaje (ej. 22 = 22%). */
  tasaTNA: number;
  /** Comisión, TNA en porcentaje (ej. 4 = 4%). */
  comisionTNA: number;
  /** El comprador es exento de IVA. */
  exento: boolean;
}

export interface CalcResult {
  montoDescontado: number;
  interes: number;
  comisionCobrada: number;
  /** IVA (21%) sobre la comisión. */
  ivaComision: number;
  /** IVA sobre el interés (0 si el comprador es exento). */
  iva: number;
  /** Retención de Ingresos Brutos. */
  iibb: number;
  /** Derechos de mercado, sin IVA. */
  ddmm: number;
  /** IVA (21%) sobre los derechos de mercado. */
  ivaDdmm: number;
  /** Derechos de mercado con IVA incluido. */
  ddmmConIva: number;
  clienteRecibe: number;
}

const IVA_ALICUOTA = 0.21;
const BASE_DIAS = 365;
/** Los derechos de mercado se prorratean sobre 90 días, no sobre 365. */
const BASE_DDMM = 90;
const IIBB_ALICUOTA = 0.005 / 100; // 0,005% sobre el monto nominal
const DDMM_ALICUOTA = 0.06 / 100; // 0,06% sobre el monto descontado

/**
 * Calcula el descuento de un eCheq sobre base 365 días.
 *
 * - El IVA del interés (cuando el comprador NO es exento) aplica únicamente
 *   sobre el interés, nunca sobre la comisión.
 * - IIBB y derechos de mercado se descuentan SIEMPRE, sea exento o no.
 * - Los derechos de mercado se prorratean sobre 90 días (no 365).
 */
export function calcular({
  plazoDias,
  monto,
  tasaTNA,
  comisionTNA,
  exento,
}: CalcInputs): CalcResult {
  const tasaProrrateada = (tasaTNA / 100) * (plazoDias / BASE_DIAS);
  const comisionProrrateada = (comisionTNA / 100) * (plazoDias / BASE_DIAS);

  const montoDescontado = monto / (1 + tasaProrrateada);
  const interes = monto - montoDescontado;
  const comisionCobrada = monto - monto / (1 + comisionProrrateada);
  const ivaComision = comisionCobrada * IVA_ALICUOTA;

  const iva = exento ? 0 : IVA_ALICUOTA * interes;

  const iibb = monto * IIBB_ALICUOTA;
  const ddmm = montoDescontado * DDMM_ALICUOTA * (plazoDias / BASE_DDMM);
  const ivaDdmm = ddmm * IVA_ALICUOTA;
  const ddmmConIva = ddmm + ivaDdmm;

  const clienteRecibe =
    montoDescontado - comisionCobrada - ivaComision - iibb - ddmmConIva - iva;

  return {
    montoDescontado,
    interes,
    comisionCobrada,
    ivaComision,
    iva,
    iibb,
    ddmm,
    ivaDdmm,
    ddmmConIva,
    clienteRecibe,
  };
}

export interface PagareInputs {
  plazoDias: number;
  monto: number;
  tasaTNA: number;
  comisionTNA: number;
}

export interface PagareResult {
  montoDescontado: number;
  interes: number;
  comisionCobrada: number;
  /** IVA (21%) sobre la comisión. En el pagaré la comisión SIEMPRE lleva IVA. */
  ivaComision: number;
  iibb: number;
  ddmm: number;
  ivaDdmm: number;
  neto: number;
}

/**
 * Descuento de un pagaré. Comparte la base de cálculo con el eCheq pero:
 * - El interés NUNCA lleva IVA.
 * - La comisión SÍ lleva IVA 21%.
 * - Los derechos de mercado llevan IVA 21% (prorrateo sobre 90 días).
 * - IIBB sin IVA.
 * - No existe la condición de comprador exento.
 */
export function calcularPagare({
  plazoDias,
  monto,
  tasaTNA,
  comisionTNA,
}: PagareInputs): PagareResult {
  const tasaProrrateada = (tasaTNA / 100) * (plazoDias / BASE_DIAS);
  const comisionProrrateada = (comisionTNA / 100) * (plazoDias / BASE_DIAS);

  const montoDescontado = monto / (1 + tasaProrrateada);
  const interes = monto - montoDescontado;
  const comisionCobrada = monto - monto / (1 + comisionProrrateada);
  const ivaComision = comisionCobrada * IVA_ALICUOTA;

  const iibb = monto * IIBB_ALICUOTA;
  const ddmm = montoDescontado * DDMM_ALICUOTA * (plazoDias / BASE_DDMM);
  const ivaDdmm = ddmm * IVA_ALICUOTA;

  const neto =
    montoDescontado - comisionCobrada - ivaComision - iibb - ddmm - ivaDdmm;

  return {
    montoDescontado,
    interes,
    comisionCobrada,
    ivaComision,
    iibb,
    ddmm,
    ivaDdmm,
    neto,
  };
}
