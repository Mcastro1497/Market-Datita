"use client";

import { useState } from "react";
import { plazoDesdeVencimiento, formatFecha } from "@/lib/financiamiento/fechas";
import { useFechas } from "./FechasProvider";
import { Field, inputCls } from "./ui";

export type Modo = "dias" | "fecha";

/**
 * Maneja el ingreso del plazo en cualquiera de los dos modos:
 * - "dias": se ingresa el plazo en días directamente.
 * - "fecha": se ingresa la fecha de vencimiento y el plazo se calcula como
 *   (vencimiento + tN días hábiles) − hoy, en días corridos.
 *
 * Devuelve el plazo resuelto en días, si es válido, y el campo a renderizar.
 */
export function usePlazo(modo: Modo, tNHabiles: number) {
  const { hoy, feriadosSet } = useFechas();
  const [dias, setDias] = useState("90");
  const [venc, setVenc] = useState("");

  let plazoDias = 0;
  let info: { liquidacion: Date; dias: number } | null = null;

  if (modo === "dias") {
    plazoDias = Math.floor(Number(dias));
  } else if (hoy) {
    info = plazoDesdeVencimiento(venc, tNHabiles, hoy, feriadosSet);
    if (info) plazoDias = info.dias;
  }

  const valido = plazoDias > 0;
  const tocado = modo === "dias" ? dias !== "" : venc !== "";
  const error = tocado && !valido;

  const field =
    modo === "dias" ? (
      <Field
        label="Plazo (días)"
        error={error ? "Ingresá un plazo mayor a 0." : undefined}
      >
        <input
          inputMode="numeric"
          value={dias}
          onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))}
          className={inputCls(error)}
          placeholder="90"
        />
      </Field>
    ) : (
      <Field
        label="Fecha de vencimiento"
        error={
          error
            ? info
              ? "El vencimiento ya pasó."
              : "Ingresá una fecha válida."
            : undefined
        }
      >
        <input
          type="date"
          value={venc}
          onChange={(e) => setVenc(e.target.value)}
          className={inputCls(error) + " text-left"}
        />
        {info && info.dias > 0 && (
          <span className="mt-1 block text-xs text-slate-500">
            Liquidación (t+{tNHabiles} háb.): {formatFecha(info.liquidacion)} ·{" "}
            {info.dias} días corridos
          </span>
        )}
      </Field>
    );

  return { plazoDias, valido, field };
}
