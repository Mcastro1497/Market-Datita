"use client";

import { useState } from "react";
import { FechasProvider } from "./FechasProvider";
import Calculator from "./Calculator";
import CarteraCalculator from "./CarteraCalculator";
import PagareCalculator from "./PagareCalculator";
import Feriados from "./Feriados";

type Modo = "dias" | "fecha" | "feriados";
type Inst = "echeq" | "cartera" | "pagare";

const MODOS: { label: string; value: Modo }[] = [
  { label: "Descuento por día", value: "dias" },
  { label: "Con fechas exactas", value: "fecha" },
  { label: "Feriados", value: "feriados" },
];

const INSTRUMENTOS: { label: string; value: Inst }[] = [
  { label: "eCheq", value: "echeq" },
  { label: "Cartera eCheq", value: "cartera" },
  { label: "Pagaré", value: "pagare" },
];

export default function CalculatorTabs() {
  const [modo, setModo] = useState<Modo>("dias");
  const [inst, setInst] = useState<Inst>("echeq");
  const calcMode = modo === "fecha" ? "fecha" : "dias";

  return (
    <FechasProvider>
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Nivel 1: modo (lateral en desktop) */}
        <aside className="md:w-48 md:shrink-0">
          <nav className="flex gap-1 overflow-x-auto rounded-xl bg-lavanda p-1 md:flex-col md:overflow-visible">
            {MODOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setModo(t.value)}
                className={[
                  "whitespace-nowrap rounded-lg px-4 py-2 text-left text-sm font-semibold transition md:w-full",
                  modo === t.value
                    ? "bg-white text-violeta shadow-sm"
                    : "text-tinta/70 hover:text-tinta",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenido */}
        <div className="min-w-0 flex-1">
          {modo === "feriados" ? (
            <Feriados />
          ) : (
            <>
              {/* Nivel 2: instrumento */}
              <div className="mb-6 inline-flex flex-wrap gap-1 rounded-lg bg-lavanda p-1">
                {INSTRUMENTOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setInst(t.value)}
                    className={[
                      "rounded-md px-4 py-1.5 text-sm font-medium transition",
                      inst === t.value
                        ? "bg-white text-violeta shadow-sm"
                        : "text-tinta/60 hover:text-tinta",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {inst === "echeq" && <Calculator mode={calcMode} />}
              {inst === "cartera" && <CarteraCalculator mode={calcMode} />}
              {inst === "pagare" && <PagareCalculator mode={calcMode} />}
            </>
          )}
        </div>
      </div>
    </FechasProvider>
  );
}
