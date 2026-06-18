"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { startOfDay } from "@/lib/financiamiento/fechas";

type Estado = "cargando" | "compartido" | "local";

interface Resultado {
  ok: boolean;
  error?: string;
}

interface FechasCtx {
  /** Hoy a medianoche, o null hasta hidratar en el cliente. */
  hoy: Date | null;
  /** Feriados cargados, en ISO "YYYY-MM-DD". */
  feriados: string[];
  feriadosSet: Set<string>;
  addFeriado: (iso: string) => Promise<Resultado>;
  removeFeriado: (iso: string) => Promise<Resultado>;
  /** Contraseña para editar feriados. */
  password: string;
  setPassword: (p: string) => void;
  /** "compartido": persisten en Vercel KV. "local": KV sin configurar. */
  estado: Estado;
}

const Context = createContext<FechasCtx | null>(null);

function ordenar(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

export function FechasProvider({ children }: { children: React.ReactNode }) {
  const [feriados, setFeriados] = useState<string[]>([]);
  const [hoy, setHoy] = useState<Date | null>(null);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setHoy(startOfDay(new Date()));
    let activo = true;
    fetch("/api/feriados")
      .then((r) => r.json())
      .then((data) => {
        if (!activo) return;
        setFeriados(ordenar(data.feriados ?? []));
        setEstado(data.configurado ? "compartido" : "local");
      })
      .catch(() => {
        if (activo) setEstado("local");
      });
    return () => {
      activo = false;
    };
  }, []);

  const editar = async (
    metodo: "POST" | "DELETE",
    iso: string,
  ): Promise<Resultado> => {
    try {
      const r = await fetch("/api/feriados", {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          "x-feriados-password": password,
        },
        body: JSON.stringify({ date: iso }),
      });
      if (!r.ok) {
        if (r.status === 401) return { ok: false, error: "Contraseña incorrecta." };
        const data = await r.json().catch(() => ({}));
        return { ok: false, error: data.error || "No se pudo guardar." };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Error de red." };
    }
  };

  const addFeriado = async (iso: string): Promise<Resultado> => {
    const res = await editar("POST", iso);
    if (res.ok) setFeriados((prev) => ordenar([...prev, iso]));
    return res;
  };

  const removeFeriado = async (iso: string): Promise<Resultado> => {
    const res = await editar("DELETE", iso);
    if (res.ok) setFeriados((prev) => prev.filter((f) => f !== iso));
    return res;
  };

  const feriadosSet = useMemo(() => new Set(feriados), [feriados]);

  const value: FechasCtx = {
    hoy,
    feriados,
    feriadosSet,
    addFeriado,
    removeFeriado,
    password,
    setPassword,
    estado,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFechas(): FechasCtx {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useFechas debe usarse dentro de <FechasProvider>");
  return ctx;
}
