"use client";

import { useMemo, useRef, useState } from "react";
import { calcular, type CalcResult } from "@/lib/financiamiento/calc";
import { formatARS, formatMilesInput, parseMilesInput } from "@/lib/financiamiento/format";
import { formatFecha, plazoDesdeVencimiento } from "@/lib/financiamiento/fechas";
import { PercentInput, ResultRow, Toggle, inputCls } from "./ui";
import { useFechas } from "./FechasProvider";
import { type Modo } from "./usePlazo";

/** Liquidación del eCheq: t+2 días hábiles. */
const T_HABILES = 2;

interface Item {
  id: number;
  montoStr: string;
  plazo: string;
  venc: string;
  tasa: string;
  comision: string;
  exento: boolean;
}

const nuevoItem = (id: number): Item => ({
  id,
  montoStr: "",
  plazo: "",
  venc: "",
  tasa: "",
  comision: "",
  exento: false,
});

interface Computed {
  item: Item;
  monto: number;
  plazoDias: number;
  liquidacion: Date | null;
  valido: boolean;
  res: CalcResult | null;
}

const TOTALES_VACIOS = {
  monto: 0,
  montoDescontado: 0,
  interes: 0,
  comisionCobrada: 0,
  ivaComision: 0,
  iva: 0,
  iibb: 0,
  ddmm: 0,
  ivaDdmm: 0,
  clienteRecibe: 0,
};

export default function CarteraCalculator({ mode = "dias" }: { mode?: Modo }) {
  const { hoy, feriadosSet } = useFechas();
  const nextId = useRef(2);
  const [items, setItems] = useState<Item[]>([
    {
      id: 0,
      montoStr: "10.000.000",
      plazo: "90",
      venc: "",
      tasa: "22",
      comision: "4",
      exento: true,
    },
    {
      id: 1,
      montoStr: "5.000.000",
      plazo: "60",
      venc: "",
      tasa: "25",
      comision: "4",
      exento: false,
    },
  ]);

  const addItem = () =>
    setItems((prev) => [...prev, nuevoItem(nextId.current++)]);
  const removeItem = (id: number) =>
    setItems((prev) => prev.filter((i) => i.id !== id));
  const updateItem = (id: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const computed: Computed[] = useMemo(
    () =>
      items.map((item) => {
        const monto = parseMilesInput(item.montoStr);
        const tasa = Number(item.tasa);
        const comision = Number(item.comision);

        let plazoDias = 0;
        let liquidacion: Date | null = null;
        if (mode === "dias") {
          plazoDias = Math.floor(Number(item.plazo));
        } else if (hoy) {
          const info = plazoDesdeVencimiento(
            item.venc,
            T_HABILES,
            hoy,
            feriadosSet,
          );
          if (info) {
            plazoDias = info.dias;
            liquidacion = info.liquidacion;
          }
        }

        const valido =
          plazoDias > 0 &&
          monto > 0 &&
          Number.isFinite(tasa) &&
          tasa >= 0 &&
          Number.isFinite(comision) &&
          comision >= 0;
        const res = valido
          ? calcular({
              plazoDias,
              monto,
              tasaTNA: tasa,
              comisionTNA: comision,
              exento: item.exento,
            })
          : null;
        return { item, monto, plazoDias, liquidacion, valido, res };
      }),
    [items, mode, hoy, feriadosSet],
  );

  const totales = useMemo(
    () =>
      computed.reduce((acc, c) => {
        if (!c.res) return acc;
        acc.monto += c.monto;
        acc.montoDescontado += c.res.montoDescontado;
        acc.interes += c.res.interes;
        acc.comisionCobrada += c.res.comisionCobrada;
        acc.ivaComision += c.res.ivaComision;
        acc.iva += c.res.iva;
        acc.iibb += c.res.iibb;
        acc.ddmm += c.res.ddmm;
        acc.ivaDdmm += c.res.ivaDdmm;
        acc.clienteRecibe += c.res.clienteRecibe;
        return acc;
      }, { ...TOTALES_VACIOS }),
    [computed],
  );

  const cantValidos = computed.filter((c) => c.res).length;

  return (
    <div className="space-y-6">
      {/* Lista de eCheqs */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            eCheqs a descontar
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg bg-violeta px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violeta-comp"
          >
            + Agregar
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-400">
            Agregá un eCheq para empezar.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 px-3 py-2"
              >
                <div className="flex flex-wrap items-end gap-2">
                  <span className="pb-2 text-xs font-semibold text-slate-400">
                    #{idx + 1}
                  </span>

                  <label className="min-w-[8rem] flex-1">
                    <span className="mb-0.5 block text-xs text-slate-500">
                      Monto
                    </span>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-sm text-slate-400">
                        $
                      </span>
                      <input
                        inputMode="numeric"
                        value={item.montoStr}
                        onChange={(e) =>
                          updateItem(item.id, {
                            montoStr: formatMilesInput(e.target.value),
                          })
                        }
                        className={inputCls(false, true) + " pl-5"}
                        placeholder="10.000.000"
                      />
                    </div>
                  </label>

                  {mode === "dias" ? (
                    <label className="w-20">
                      <span className="mb-0.5 block text-xs text-slate-500">
                        Plazo
                      </span>
                      <input
                        inputMode="numeric"
                        value={item.plazo}
                        onChange={(e) =>
                          updateItem(item.id, {
                            plazo: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        className={inputCls(false, true)}
                        placeholder="90"
                      />
                    </label>
                  ) : (
                    <label className="min-w-[8.5rem] flex-1">
                      <span className="mb-0.5 block text-xs text-slate-500">
                        Vencimiento
                      </span>
                      <input
                        type="date"
                        value={item.venc}
                        onChange={(e) =>
                          updateItem(item.id, { venc: e.target.value })
                        }
                        className={inputCls(false, true) + " text-left"}
                      />
                    </label>
                  )}

                  <label className="w-[4.5rem]">
                    <span className="mb-0.5 block text-xs text-slate-500">
                      Tasa
                    </span>
                    <PercentInput
                      value={item.tasa}
                      onChange={(v) => updateItem(item.id, { tasa: v })}
                      placeholder="22"
                      compact
                    />
                  </label>

                  <label className="w-[4.5rem]">
                    <span className="mb-0.5 block text-xs text-slate-500">
                      Comisión
                    </span>
                    <PercentInput
                      value={item.comision}
                      onChange={(v) => updateItem(item.id, { comision: v })}
                      placeholder="4"
                      compact
                    />
                  </label>

                  <label>
                    <span className="mb-0.5 block text-xs text-slate-500">
                      Exento
                    </span>
                    <Toggle
                      value={item.exento}
                      onChange={(v) => updateItem(item.id, { exento: v })}
                      compact
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="pb-1.5 text-lg leading-none text-slate-300 transition hover:text-red-500"
                    aria-label="Eliminar eCheq"
                  >
                    ✕
                  </button>
                </div>

                {mode === "fecha" &&
                  computed[idx]?.liquidacion &&
                  computed[idx].plazoDias > 0 && (
                    <span className="mt-1 block text-xs text-slate-500">
                      Liquidación (t+{T_HABILES} háb.):{" "}
                      {formatFecha(computed[idx].liquidacion as Date)} ·{" "}
                      {computed[idx].plazoDias} días corridos
                    </span>
                  )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Totales */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Totales{" "}
          <span className="font-normal normal-case text-slate-400">
            ({cantValidos} {cantValidos === 1 ? "eCheq" : "eCheqs"})
          </span>
        </h2>

        {cantValidos > 0 ? (
          <div className="space-y-3">
            <ResultRow
              label="Total nominal (suma de eCheqs)"
              value={formatARS(totales.monto)}
            />
            <ResultRow
              label="Total monto descontado"
              value={formatARS(totales.montoDescontado)}
            />
            <ResultRow
              label="Total interés"
              value={formatARS(totales.interes)}
            />
            <ResultRow
              label="Total comisión"
              value={formatARS(totales.comisionCobrada)}
            />
            <ResultRow
              label="Total IVA comisión"
              value={formatARS(totales.ivaComision)}
            />
            <ResultRow
              label="Total IVA interés"
              value={formatARS(totales.iva)}
            />
            <ResultRow label="Total IIBB" value={formatARS(totales.iibb)} />
            <ResultRow
              label="Total derechos de mercado"
              value={formatARS(totales.ddmm)}
            />
            <ResultRow
              label="Total IVA derechos"
              value={formatARS(totales.ivaDdmm)}
            />

            <div className="mt-5 rounded-xl bg-violeta p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-lavanda">
                Total neto que recibe el cliente
              </p>
              <p className="mt-1 whitespace-nowrap text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {formatARS(totales.clienteRecibe)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Completá al menos un eCheq para ver los totales.
          </p>
        )}
      </section>

      {/* Detalle por eCheq (desplegable) */}
      {cantValidos > 0 && (
        <section className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Ver detalle por eCheq
              <span className="text-slate-400 transition group-open:rotate-180">
                ▾
              </span>
            </summary>

            <div className="space-y-4 px-4 pb-4 pt-2">
              {computed.map((c, idx) =>
                c.res ? (
                  <div
                    key={c.item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <p className="mb-3 text-sm font-semibold text-slate-700">
                      eCheq #{idx + 1}{" "}
                      <span className="font-normal text-slate-400">
                        · {formatARS(c.monto)} · {c.plazoDias} días ·{" "}
                        {c.item.exento ? "exento" : "no exento"}
                      </span>
                    </p>
                    <div className="space-y-3">
                      <ResultRow
                        label="Monto descontado"
                        value={formatARS(c.res.montoDescontado)}
                      />
                      <ResultRow
                        label="Interés"
                        value={formatARS(c.res.interes)}
                      />
                      <ResultRow
                        label="Comisión"
                        value={formatARS(c.res.comisionCobrada)}
                      />
                      <ResultRow
                        label="IVA comisión"
                        value={formatARS(c.res.ivaComision)}
                      />
                      {!c.item.exento && (
                        <ResultRow
                          label="IVA interés"
                          value={formatARS(c.res.iva)}
                        />
                      )}
                      <ResultRow
                        label="Retención IIBB"
                        value={formatARS(c.res.iibb)}
                      />
                      <ResultRow
                        label="Derechos de mercado"
                        value={formatARS(c.res.ddmm)}
                      />
                      <ResultRow
                        label="IVA derechos"
                        value={formatARS(c.res.ivaDdmm)}
                      />
                      <div className="flex items-center justify-between gap-4 pt-1">
                        <span className="text-sm font-semibold text-violeta">
                          Neto
                        </span>
                        <span className="whitespace-nowrap text-base font-bold tabular-nums text-violeta">
                          {formatARS(c.res.clienteRecibe)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
