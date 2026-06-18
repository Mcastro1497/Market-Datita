"use client";

import { useMemo, useState } from "react";
import { calcularPagare } from "@/lib/financiamiento/calc";
import {
  formatARS,
  formatMilesInput,
  formatUSD,
  parseMilesInput,
} from "@/lib/financiamiento/format";
import {
  Field,
  NumberInput,
  PercentInput,
  ResultRow,
  SegmentedControl,
  inputCls,
} from "./ui";
import { usePlazo, type Modo } from "./usePlazo";

type Moneda = "ARS" | "MEP" | "A3500" | "BNA";

const MONEDAS: { label: string; value: Moneda }[] = [
  { label: "Pesos", value: "ARS" },
  { label: "USD MEP", value: "MEP" },
  { label: "USD A3500", value: "A3500" },
  { label: "USD BNA", value: "BNA" },
];

/** Las monedas que requieren tipo de cambio para pesificar el neto. */
const REQUIERE_TC = (m: Moneda) => m === "A3500" || m === "BNA";

/** Liquidación del pagaré: t+1 día hábil. */
const T_HABILES = 1;

export default function PagareCalculator({ mode = "dias" }: { mode?: Modo }) {
  const { plazoDias, valido: plazoValido, field: plazoField } = usePlazo(
    mode,
    T_HABILES,
  );
  const [montoStr, setMontoStr] = useState("10.000.000");
  const [tasa, setTasa] = useState("22");
  const [comision, setComision] = useState("4");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [tcStr, setTcStr] = useState("");

  const montoNum = parseMilesInput(montoStr);
  const tasaNum = Number(tasa);
  const comisionNum = Number(comision);
  const tcNum = Number(tcStr);
  const necesitaTc = REQUIERE_TC(moneda);

  const errors = {
    monto: montoStr !== "" && montoNum <= 0,
    tasa: tasa !== "" && (!Number.isFinite(tasaNum) || tasaNum < 0),
    comision:
      comision !== "" && (!Number.isFinite(comisionNum) || comisionNum < 0),
    tc: necesitaTc && tcStr !== "" && (!Number.isFinite(tcNum) || tcNum <= 0),
  };

  const inputsValidos =
    plazoValido &&
    montoNum > 0 &&
    Number.isFinite(tasaNum) &&
    tasaNum >= 0 &&
    Number.isFinite(comisionNum) &&
    comisionNum >= 0 &&
    (!necesitaTc || (Number.isFinite(tcNum) && tcNum > 0));

  const result = useMemo(() => {
    if (!inputsValidos) return null;
    return calcularPagare({
      plazoDias,
      monto: montoNum,
      tasaTNA: tasaNum,
      comisionTNA: comisionNum,
    });
  }, [inputsValidos, plazoDias, montoNum, tasaNum, comisionNum]);

  // El monto se ingresa en USD para cualquier moneda USD.
  const montoEnUSD = moneda !== "ARS";
  // A3500 / BNA: se pesifica TODO. Se toma el monto descontado (USD), se
  // multiplica por el TC y el resto de los costos y el neto quedan en pesos.
  // (Como todo es lineal en el monto, equivale a multiplicar cada ítem por el TC.)
  const factor = necesitaTc ? tcNum : 1;
  // Moneda de visualización del detalle: USD solo para MEP; pesos para el resto.
  const fmt = moneda === "MEP" ? formatUSD : formatARS;
  const v = (x: number) => fmt(x * factor);
  // Referencia: neto en USD cuando se pesificó (A3500 / BNA).
  const netoUSD = result && necesitaTc ? result.neto : null;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      {/* Formulario */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos del pagaré
        </h2>

        <div className="space-y-5">
          <Field label="Moneda">
            <SegmentedControl
              options={MONEDAS}
              value={moneda}
              onChange={setMoneda}
            />
          </Field>

          {necesitaTc && (
            <Field
              label="Tipo de cambio"
              error={errors.tc ? "Ingresá un tipo de cambio mayor a 0." : undefined}
            >
              <NumberInput
                value={tcStr}
                onChange={setTcStr}
                error={errors.tc}
                placeholder="1000"
              />
            </Field>
          )}

          <Field
            label={montoEnUSD ? "Monto del pagaré (USD)" : "Monto del pagaré"}
            error={errors.monto ? "El monto debe ser mayor a 0." : undefined}
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                {montoEnUSD ? "US$" : "$"}
              </span>
              <input
                inputMode="numeric"
                value={montoStr}
                onChange={(e) => setMontoStr(formatMilesInput(e.target.value))}
                className={
                  inputCls(errors.monto) + (montoEnUSD ? " pl-11" : " pl-7")
                }
                placeholder="10.000.000"
              />
            </div>
          </Field>

          {plazoField}

          <Field
            label="Tasa descontada (TNA)"
            error={errors.tasa ? "Inválida." : undefined}
          >
            <PercentInput
              value={tasa}
              onChange={setTasa}
              error={errors.tasa}
              placeholder="22"
            />
          </Field>

          <Field
            label="Comisión (TNA)"
            error={errors.comision ? "Inválida." : undefined}
          >
            <PercentInput
              value={comision}
              onChange={setComision}
              error={errors.comision}
              placeholder="4"
            />
          </Field>
        </div>
      </section>

      {/* Resultados */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Resultado
        </h2>

        {result ? (
          <div className="space-y-3">
            <ResultRow
              label="Monto descontado"
              value={v(result.montoDescontado)}
            />
            <ResultRow label="Interés" value={v(result.interes)} />
            <ResultRow label="Comisión" value={v(result.comisionCobrada)} />
            <ResultRow
              label="IVA (21% s/ comisión)"
              value={v(result.ivaComision)}
            />
            <ResultRow label="Retención IIBB" value={v(result.iibb)} />
            <ResultRow label="Derechos de mercado" value={v(result.ddmm)} />
            <ResultRow
              label="IVA (21% s/ derechos)"
              value={v(result.ivaDdmm)}
            />

            <div className="mt-5 rounded-xl bg-violeta p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-lavanda">
                Neto que recibe el cliente
              </p>
              <p className="mt-1 whitespace-nowrap text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {v(result.neto)}
              </p>
              {netoUSD !== null && (
                <p className="mt-1 whitespace-nowrap text-sm font-medium tabular-nums text-lavanda">
                  Neto en USD: {formatUSD(netoUSD)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Completá los datos para ver el cálculo.
          </p>
        )}
      </section>
    </div>
  );
}
