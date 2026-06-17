"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LineChart as LineChartIcon, Loader2 } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Punto = { fecha: string; valor: number }

// Series elegidas, agrupadas por unidad (no se pueden mezclar $ con % en un eje).
type SerieDef = { id: number; label: string; color: string }
type Grupo = {
  key: string
  title: string
  descripcion: string
  unidad: "$" | "%" | "USD" | "idx"
  series: SerieDef[]
}

const GRUPOS: Grupo[] = [
  {
    key: "fx",
    title: "Dólar y bandas cambiarias",
    descripcion: "Mayorista (A3500), minorista y límites de la banda",
    unidad: "$",
    series: [
      { id: 5, label: "Mayorista (A3500)", color: "#522398" },
      { id: 4, label: "Minorista", color: "#8555ff" },
      { id: 1187, label: "Banda inferior", color: "#94a3b8" },
      { id: 1188, label: "Banda superior", color: "#94a3b8" },
    ],
  },
  {
    key: "tasas",
    title: "Tasas de interés",
    descripcion: "BADLAR y TAMAR de bancos privados (TNA)",
    unidad: "%",
    series: [
      { id: 7, label: "BADLAR", color: "#522398" },
      { id: 44, label: "TAMAR", color: "#8555ff" },
    ],
  },
  {
    key: "inflacion",
    title: "Inflación",
    descripcion: "Mensual, interanual y expectativa REM a 12 meses",
    unidad: "%",
    series: [
      { id: 27, label: "Mensual", color: "#522398" },
      { id: 28, label: "Interanual", color: "#8555ff" },
      { id: 29, label: "REM 12m", color: "#5632b2" },
    ],
  },
  {
    key: "reservas",
    title: "Reservas internacionales",
    descripcion: "Reservas del BCRA",
    unidad: "USD",
    series: [{ id: 1, label: "Reservas", color: "#522398" }],
  },
  {
    key: "cer",
    title: "CER",
    descripcion: "Coeficiente de estabilización de referencia",
    unidad: "idx",
    series: [{ id: 30, label: "CER", color: "#522398" }],
  },
  {
    key: "uva",
    title: "UVA",
    descripcion: "Unidad de valor adquisitivo",
    unidad: "idx",
    series: [{ id: 31, label: "UVA", color: "#522398" }],
  },
]

const ALL_IDS = GRUPOS.flatMap((g) => g.series.map((s) => s.id))

type Rango = "1A" | "3A" | "5A" | "max"
const RANGOS: { label: string; value: Rango; years: number | null }[] = [
  { label: "1A", value: "1A", years: 1 },
  { label: "3A", value: "3A", years: 3 },
  { label: "5A", value: "5A", years: 5 },
  { label: "Máx", value: "max", years: null },
]

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 })
const nfAxis = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0, notation: "compact" })

function fmtFechaCorta(iso: string) {
  const [y, m] = iso.split("-")
  return `${m}/${y.slice(2)}`
}

export default function MacroPage() {
  const [rango, setRango] = useState<Rango>("3A")
  const [series, setSeries] = useState<Record<string, Punto[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    const hoy = new Date()
    const def = RANGOS.find((r) => r.value === rango)!
    const desde = def.years
      ? new Date(hoy.getFullYear() - def.years, hoy.getMonth(), hoy.getDate())
          .toISOString()
          .slice(0, 10)
      : "2002-01-01"
    const hasta = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate())
      .toISOString()
      .slice(0, 10) // +1 año para incluir CER/UVA/bandas proyectados
    ;(async () => {
      try {
        const res = await fetch(
          `/api/macro?ids=${ALL_IDS.join(",")}&desde=${desde}&hasta=${hasta}`,
        )
        const json = await res.json()
        if (!cancel) setSeries(json.series ?? {})
      } catch {
        if (!cancel) setSeries({})
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [rango])

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <LineChartIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Macro</h1>
                <p className="text-muted-foreground">
                  Evolución de variables monetarias del BCRA
                </p>
              </div>
            </div>
            <ToggleGroup
              type="single"
              value={rango}
              onValueChange={(v) => v && setRango(v as Rango)}
              variant="outline"
              size="sm"
            >
              {RANGOS.map((r) => (
                <ToggleGroupItem key={r.value} value={r.value}>
                  {r.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando series del BCRA...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {GRUPOS.map((g) => (
              <GrupoChart key={g.key} grupo={g} series={series} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GrupoChart({ grupo, series }: { grupo: Grupo; series: Record<string, Punto[]> }) {
  // Mergeamos las series del grupo por fecha en una sola tabla para el chart.
  const data = useMemo(() => {
    const byFecha = new Map<string, Record<string, number | string>>()
    for (const s of grupo.series) {
      for (const p of series[s.id] ?? []) {
        let row = byFecha.get(p.fecha)
        if (!row) {
          row = { fecha: p.fecha }
          byFecha.set(p.fecha, row)
        }
        row[`s${s.id}`] = p.valor
      }
    }
    return Array.from(byFecha.values()).sort((a, b) =>
      String(a.fecha).localeCompare(String(b.fecha)),
    )
  }, [grupo, series])

  const ultimos = grupo.series.map((s) => {
    const arr = series[s.id] ?? []
    return { ...s, last: arr.length ? arr[arr.length - 1].valor : null }
  })

  const sufijo = grupo.unidad === "%" ? "%" : ""
  const prefijo = grupo.unidad === "$" ? "$" : ""

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{grupo.title}</CardTitle>
            <CardDescription>{grupo.descripcion}</CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {ultimos.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}:</span>
              <span className="font-mono font-semibold text-foreground">
                {s.last == null ? "—" : `${prefijo}${nf.format(s.last)}${sufijo}`}
              </span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Sin datos.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="fecha"
                tickFormatter={fmtFechaCorta}
                minTickGap={48}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <YAxis
                width={48}
                tickFormatter={(v) => nfAxis.format(v as number)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                domain={["auto", "auto"]}
              />
              <Tooltip
                formatter={(v: number, _n, item) => {
                  const def = grupo.series.find((s) => `s${s.id}` === item.dataKey)
                  return [`${prefijo}${nf.format(v)}${sufijo}`, def?.label ?? ""]
                }}
                labelFormatter={(l) => {
                  const [y, m, d] = String(l).split("-")
                  return `${d}/${m}/${y}`
                }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              {grupo.series.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={`s${s.id}`}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.id === 1187 || s.id === 1188 ? "5 4" : undefined}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
