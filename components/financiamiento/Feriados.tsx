"use client";

import { useState } from "react";
import { formatFecha, parseISO } from "@/lib/financiamiento/fechas";
import { useFechas } from "./FechasProvider";
import { inputCls } from "./ui";

export default function Feriados() {
  const {
    feriados,
    addFeriado,
    removeFeriado,
    password,
    setPassword,
    estado,
  } = useFechas();
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const agregar = async () => {
    if (!nuevo) return;
    setError(null);
    const res = await addFeriado(nuevo);
    if (res.ok) setNuevo("");
    else setError(res.error ?? "No se pudo agregar.");
  };

  const eliminar = async (iso: string) => {
    setError(null);
    const res = await removeFeriado(iso);
    if (!res.ok) setError(res.error ?? "No se pudo eliminar.");
  };

  const sinPassword = password === "";

  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Feriados
      </h2>
      <p className="mb-3 text-sm text-slate-500">
        Cargá los feriados que querés excluir al contar los días hábiles del
        t+2 / t+1.
      </p>
      <p className="mb-5 text-xs font-medium">
        {estado === "cargando" && (
          <span className="text-slate-400">Cargando…</span>
        )}
        {estado === "compartido" && (
          <span className="text-violeta">
            ✓ Compartidos: persisten en la base y los ve todo el equipo.
          </span>
        )}
        {estado === "local" && (
          <span className="text-amber-600">
            ⚠ Base sin configurar: por ahora solo en esta sesión.
          </span>
        )}
      </p>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Contraseña para editar
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls(false) + " text-left"}
          placeholder="••••••••"
        />
      </label>

      <div className="flex gap-2">
        <input
          type="date"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          className={inputCls(false) + " text-left"}
        />
        <button
          type="button"
          onClick={agregar}
          disabled={!nuevo || sinPassword}
          className="shrink-0 rounded-lg bg-violeta px-4 py-2 text-sm font-semibold text-white transition hover:bg-violeta-comp disabled:cursor-not-allowed disabled:opacity-40"
        >
          Agregar
        </button>
      </div>

      {sinPassword && (
        <p className="mt-2 text-xs text-slate-400">
          Ingresá la contraseña para poder agregar o eliminar feriados.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-6">
        {feriados.length === 0 ? (
          <p className="text-sm text-slate-400">No hay feriados cargados.</p>
        ) : (
          <ul className="space-y-2">
            {feriados.map((iso) => {
              const d = parseISO(iso);
              return (
                <li
                  key={iso}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="text-sm tabular-nums text-slate-700">
                    {d ? formatFecha(d) : iso}
                  </span>
                  <button
                    type="button"
                    onClick={() => eliminar(iso)}
                    disabled={sinPassword}
                    className="text-sm font-medium text-slate-400 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Eliminar feriado"
                  >
                    Eliminar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
