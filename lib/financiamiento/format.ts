const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const milesFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un número como moneda ARS: $ 9.387.728,06 */
export function formatARS(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return arsFormatter.format(value);
}

/** Formatea un número como moneda USD: US$ 9.387.728,06 */
export function formatUSD(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return usdFormatter.format(value);
}

/**
 * Deja sólo dígitos de un string y lo devuelve agrupado en miles con
 * punto (ej. "10000000" -> "10.000.000"). Cadena vacía si no hay dígitos.
 */
export function formatMilesInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  return milesFormatter.format(Number(digits));
}

/** Convierte un input agrupado en miles a número (ej. "10.000.000" -> 10000000). */
export function parseMilesInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits === "" ? 0 : Number(digits);
}
