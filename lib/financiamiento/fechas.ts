/** Fecha a medianoche local (descarta la hora). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parsea un ISO "YYYY-MM-DD" a Date local. Null si es inválido. */
export function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date local a ISO "YYYY-MM-DD". */
export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const fechaFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Formatea una fecha como dd/mm/yyyy. */
export function formatFecha(d: Date): string {
  return fechaFormatter.format(d);
}

/** True si la fecha es día hábil (no fin de semana ni feriado). */
export function esHabil(d: Date, feriados: Set<string>): boolean {
  const dow = d.getDay(); // 0 = domingo, 6 = sábado
  if (dow === 0 || dow === 6) return false;
  return !feriados.has(toISO(d));
}

/** Suma `n` días hábiles a una fecha, salteando fines de semana y feriados. */
export function sumarHabiles(d: Date, n: number, feriados: Set<string>): Date {
  let result = startOfDay(d);
  let agregados = 0;
  while (agregados < n) {
    result = new Date(
      result.getFullYear(),
      result.getMonth(),
      result.getDate() + 1,
    );
    if (esHabil(result, feriados)) agregados++;
  }
  return result;
}

/** Diferencia en días corridos enteros (a - b). */
export function diffDiasCorridos(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Calcula el plazo del descuento a partir de la fecha de vencimiento.
 *
 * plazo = (vencimiento + tN días hábiles) − hoy, en días corridos.
 * Devuelve también la fecha de liquidación. Null si el vencimiento es inválido.
 */
export function plazoDesdeVencimiento(
  vencISO: string,
  tNHabiles: number,
  hoy: Date,
  feriados: Set<string>,
): { liquidacion: Date; dias: number } | null {
  const venc = parseISO(vencISO);
  if (!venc) return null;
  const liquidacion = sumarHabiles(venc, tNHabiles, feriados);
  const dias = diffDiasCorridos(liquidacion, hoy);
  return { liquidacion, dias };
}
