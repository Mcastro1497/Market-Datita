/**
 * Formato de montos en pesos.
 *
 * Los decimales dependen de la magnitud. Un bono dólar linked cotiza a 148.000
 * pesos: los centavos ahí no son precisión, son dos caracteres de ruido que
 * además estiran el número hasta desbordar la caja donde está. En cambio el tipo
 * de cambio, 1.514,50, sí los necesita — media unidad es medio peso por dólar.
 *
 * El corte en 10.000 deja a cada uno de su lado: precios de bonos sin centavos,
 * FX y precios chicos con ellos.
 */
export function montoArs(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—"
  const decimales = Math.abs(v) >= 10000 ? 0 : 2
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS",
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  }).format(v)
}

/** Igual que montoArs pero en dólares. */
export function montoUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—"
  const decimales = Math.abs(v) >= 10000 ? 0 : 2
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "USD",
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  }).format(v)
}
