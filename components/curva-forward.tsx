"use client"

/**
 * Curva spot y forwards, en vivo. Sirve a cualquier universo de bonos.
 *
 * POR QUÉ NO HAY TABLA EN LA BASE
 * Todo sale de `prices` (ytm, duration_y, last) e `instruments`, que la página ya
 * trae. Son unas decenas de potencias: guardarlas sería duplicar dato derivado que
 * queda desincronizado del precio en cuanto se mueve la rueda. Se recalcula en cada
 * refresco de SWR. Si algún día hace falta el histórico —cómo era la curva hace un
 * mes— ahí sí hay que persistir, porque `prices` sólo guarda el estado actual.
 *
 * POR QUÉ RECIBE GRUPOS Y NO UN UNIVERSO PLANO
 * Dos bonos van en la misma curva sólo si su TIR mide lo mismo. En hard dollar eso
 * obliga a partir por legislación: AL30 y GD30 comparten flujo, emisor y
 * vencimiento y cotizan distinto, así que en una sola curva ese spread de
 * jurisdicción se leería como si fuera plazo. En dólar linked hay un solo grupo.
 * Ojo al reusarlo en pesos: la TIR de un CER es REAL y la de un FIJA es NOMINAL,
 * y ésas no comparten eje.
 *
 * La spot va con todos los grupos juntos, que es donde se ve el spread entre
 * curvas. Las forward van una por grupo: cada una arranca en su propio short y
 * superpuestas no se comparan contra nada.
 */

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Minus, Plus, Settings2 } from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"

type Bono = { symbol: string; dur: number; ytm: number; px: number | null; vto: string | null }
type Tramo = { short: Bono; bono: Bono; dt: number; fwd: number }

export type GrupoCurva = {
  key: string
  nombre: string
  /** Qué filas del universo caen en este grupo. */
  incluye: (flow: any) => boolean
}

/**
 * Paleta. Los violetas son tokens de LB y cambian solos con el tema; los naranjas
 * son literales porque la marca no tiene ninguno, y con puro violeta dos series no
 * se distinguen. El verde menta de --chart-3 quedó afuera: contra el fondo claro
 * (#fbfafd) casi no se ve.
 */
export const PALETA = [
  { c: "var(--chart-1)", nombre: "Violeta" },
  { c: "var(--chart-4)", nombre: "Violeta oscuro" },
  { c: "var(--chart-2)", nombre: "Violeta claro" },
  { c: "var(--chart-5)", nombre: "Lavanda" },
  { c: "#c2410c", nombre: "Naranja oscuro" },
  { c: "#ea580c", nombre: "Naranja" },
  { c: "var(--success)", nombre: "Verde oscuro" },
  { c: "var(--destructive)", nombre: "Rojo" },
  { c: "var(--foreground)", nombre: "Tinta" },
]
const COLOR_INICIAL = ["var(--chart-1)", "#c2410c", "var(--chart-4)", "var(--success)"]

type TipoAjuste = "none" | "log" | "poly"
type Ajuste = { tipo: TipoAjuste; grado: number }

type Props = {
  flows: any[]
  grupos: GrupoCurva[]
  titulo: string
  /** Tabla y columnas de spread entre los dos primeros grupos, por igual vencimiento. */
  spread?: { titulo: string; descripcion: string }
}

const pct = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || !isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`

/** F(1,2) = [ (1+R2)^t2 / (1+R1)^t1 ] ^ ( 1/(t2-t1) ) - 1 */
function forward(a: Bono, b: Bono): number {
  return Math.pow(Math.pow(1 + b.ytm, b.dur) / Math.pow(1 + a.ytm, a.dur), 1 / (b.dur - a.dur)) - 1
}

// ── Regresiones ──────────────────────────────────────────────────────────────
// Mínimos cuadrados a mano: son ecuaciones normales de 2 a 7 incógnitas sobre
// menos de veinte puntos, no justifica traer una librería.

/** Resuelve A·x = b por Gauss con pivoteo parcial. null si la matriz es singular. */
function resolver(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((fila, i) => [...fila, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let f = col + 1; f < n; f++) if (Math.abs(M[f][col]) > Math.abs(M[piv][col])) piv = f
    if (Math.abs(M[piv][col]) < 1e-12) return null
    ;[M[col], M[piv]] = [M[piv], M[col]]
    for (let f = col + 1; f < n; f++) {
      const k = M[f][col] / M[col][col]
      for (let c = col; c <= n; c++) M[f][c] -= k * M[col][c]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n]
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]
    x[i] = s / M[i][i]
  }
  return x
}

/**
 * y = c0 + c1·z + … + cn·zⁿ, con z = (t − media) / desvío.
 * Se centra y escala porque sin eso t⁵ con t ≈ 6 años deja la matriz mal
 * condicionada y el ajuste sale con ruido numérico.
 */
function ajustePoly(xs: number[], ys: number[], grado: number) {
  const n = grado + 1
  if (xs.length < n) return null
  const media = xs.reduce((a, b) => a + b, 0) / xs.length
  const desvio = Math.sqrt(xs.reduce((a, x) => a + (x - media) ** 2, 0) / xs.length) || 1
  const z = xs.map((x) => (x - media) / desvio)
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < n; i++) {
    A.push(new Array(n).fill(0).map((_, j) => z.reduce((a, zi) => a + zi ** (i + j), 0)))
    b.push(z.reduce((a, zi, k) => a + zi ** i * ys[k], 0))
  }
  const c = resolver(A, b)
  if (!c) return null
  return (t: number) => {
    const zt = (t - media) / desvio
    return c.reduce((a, ci, i) => a + ci * zt ** i, 0)
  }
}

/** y = a + b·ln(t). Todas las durations son > 0, así que el log siempre existe. */
function ajusteLog(xs: number[], ys: number[]) {
  if (xs.length < 2) return null
  const l = xs.map(Math.log)
  const n = l.length
  const ml = l.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (l[i] - ml) * (ys[i] - my); den += (l[i] - ml) ** 2 }
  if (den < 1e-12) return null
  const b = num / den
  const a = my - b * ml
  return (t: number) => a + b * Math.log(t)
}

function ajustar(pts: { x: number; y: number }[], aj: Ajuste) {
  if (aj.tipo === "none" || pts.length < 2) return null
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  return aj.tipo === "log" ? ajusteLog(xs, ys) : ajustePoly(xs, ys, aj.grado)
}

/** Marcas del eje X en valores redondos, no en las durations crudas. */
function marcasX(min: number, max: number): number[] {
  const rango = max - min
  const paso = rango > 8 ? 2 : rango > 3 ? 1 : rango > 1.2 ? 0.5 : 0.25
  const out: number[] = []
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(Number(v.toFixed(2)))
  return out
}

/**
 * Dónde va la etiqueta de cada punto. AL30 y AO28 caen a 0,036 años uno del otro
 * y se pisan. Alternar arriba/abajo a ciegas no alcanza: si el de abajo lleva la
 * etiqueta arriba y el de arriba la lleva abajo, las dos terminan en el medio,
 * justo lo que pasaba. Dentro de cada racimo de durations cercanas se ordena por
 * TIR: el más alto la lleva arriba y el más bajo, abajo, que es la única
 * asignación que las separa.
 */
function desplazar(pts: { dur: number; __y: number }[]): number[] {
  const dys = new Array(pts.length).fill(-10)
  let i = 0
  while (i < pts.length) {
    let j = i
    while (j + 1 < pts.length && pts[j + 1].dur - pts[j].dur < 0.12) j++
    if (j > i) {
      const racimo = []
      for (let k = i; k <= j; k++) racimo.push({ k, y: pts[k].__y })
      racimo.sort((a, b) => b.y - a.y)          // de mayor a menor TIR
      racimo.forEach((r, orden) => {
        dys[r.k] = orden === 0 ? -13 : orden === racimo.length - 1 ? 20 : -13 - orden * 13
      })
    }
    i = j + 1
  }
  return dys
}

function Punto(props: any) {
  const { cx, cy, payload, dataKey, color } = props
  if (payload?.[dataKey] == null || cx === undefined || cy === undefined) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="var(--background)" strokeWidth={2} />
      <text
        x={cx} y={cy + (payload.dy ?? -10)} textAnchor="middle"
        fontSize={10} fill="var(--muted-foreground)"
        stroke="var(--background)" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round"
      >
        {payload.symbol}
      </text>
    </g>
  )
}

const estiloTooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
}

// ── Rueda de configuración ───────────────────────────────────────────────────
function Rueda({
  ajuste, setAjuste, maxGrado, grupos, colores, setColor, children,
}: {
  ajuste: Ajuste
  setAjuste: (a: Ajuste) => void
  maxGrado: number
  grupos: GrupoCurva[]
  colores: Record<string, string>
  setColor: (k: string, c: string) => void
  children?: React.ReactNode
}) {
  const grado = Math.min(ajuste.grado, maxGrado)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configurar gráfico">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Regresión</div>
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {([["log", "log"], ["poly", "poly"], ["none", "ninguna"]] as const).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setAjuste({ ...ajuste, tipo: t })}
                className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                  ajuste.tipo === t
                    ? "bg-background font-medium text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {ajuste.tipo === "poly" && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grado</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={() => setAjuste({ ...ajuste, grado: Math.max(1, grado - 1) })}
                disabled={grado <= 1} aria-label="Bajar grado">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <div className="w-12 rounded-md border py-1 text-center text-sm tabular-nums">{grado}</div>
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={() => setAjuste({ ...ajuste, grado: Math.min(maxGrado, grado + 1) })}
                disabled={grado >= maxGrado} aria-label="Subir grado">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">máx. {maxGrado}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {grupos.length > 1 ? "Colores" : "Color"}
          </div>
          {grupos.map((g) => (
            <div key={g.key} className="space-y-1">
              {grupos.length > 1 && <div className="text-xs text-muted-foreground">{g.nombre}</div>}
              <div className="flex flex-wrap gap-1.5">
                {PALETA.map((p) => (
                  <button
                    key={p.c}
                    type="button"
                    title={p.nombre}
                    aria-label={`${g.nombre}: ${p.nombre}`}
                    onClick={() => setColor(g.key, p.c)}
                    style={{ background: p.c }}
                    className={`h-6 w-6 rounded-full border transition-transform ${
                      colores[g.key] === p.c ? "scale-110 border-foreground" : "border-border hover:scale-105"
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {children}
      </PopoverContent>
    </Popover>
  )
}

// ── Componente ───────────────────────────────────────────────────────────────
export function CurvaForward({ flows, grupos, titulo, spread }: Props) {
  const bonos = useMemo(() => {
    const out: Record<string, Bono[]> = {}
    for (const g of grupos) out[g.key] = []
    for (const f of flows) {
      const g = grupos.find((x) => x.incluye(f))
      const ytm = f?.lastPrice?.ytm
      const dur = f?.lastPrice?.duration_y
      if (!g || ytm == null || dur == null || !(Number(dur) > 0)) continue
      out[g.key].push({
        symbol: f.ticker,
        dur: Number(dur),
        ytm: Number(ytm),
        // `last` es el precio del ticker D (AL30D), que es el que cotiza en dólares.
        px: f?.lastPrice?.last ?? f?.lastPrice?.closing_price ?? null,
        vto: f?.details?.vencimiento ?? null,
      })
    }
    for (const g of grupos) out[g.key].sort((a, b) => a.dur - b.dur)
    return out
  }, [flows, grupos])

  const [colores, setColores] = useState<Record<string, string>>(() =>
    Object.fromEntries(grupos.map((g, i) => [g.key, COLOR_INICIAL[i % COLOR_INICIAL.length]])))
  const setColor = (k: string, c: string) => setColores((s) => ({ ...s, [k]: c }))

  const [ajSpot, setAjSpot] = useState<Ajuste>({ tipo: "poly", grado: 3 })
  const [ajFwd, setAjFwd] = useState<Record<string, Ajuste>>(() =>
    Object.fromEntries(grupos.map((g) => [g.key, { tipo: "log" as TipoAjuste, grado: 3 }])))
  const [short, setShort] = useState<Record<string, string>>({})

  const shortDe = (k: string) => bonos[k]?.find((b) => b.symbol === short[k]) ?? bonos[k]?.[0] ?? null
  // n-2 y no n-1: con grado n-1 el polinomio pasa exactamente por los n puntos y
  // deja de ser un ajuste. Con 4 bonos, como dólar linked, el tope real es 2.
  const gradoTope = (k: string) => Math.max(1, Math.min(6, bonos[k].length - 2))
  const gradoTopeTodos = Math.max(1, Math.min(...grupos.map((g) => gradoTope(g.key))))

  const tramos = useMemo(() => {
    const out: Record<string, Tramo[]> = {}
    for (const g of grupos) {
      out[g.key] = []
      const B = bonos[g.key]
      const s = shortDe(g.key)
      if (!s) continue
      const i = B.findIndex((b) => b.symbol === s.symbol)
      for (let j = i + 1; j < B.length; j++) {
        out[g.key].push({ short: s, bono: B[j], dt: B[j].dur - s.dur, fwd: forward(s, B[j]) })
      }
    }
    return out
  }, [bonos, short, grupos])

  /**
   * Una fila por duration con el valor de cada grupo donde exista, más las filas
   * del ajuste (`${key}__fit`). connectNulls une cada serie salteando las filas
   * que no son suyas.
   */
  function armar(
    cuales: GrupoCurva[],
    porGrupo: Record<string, { dur: number; symbol: string; y: number; meta: any }[]>,
    aj: (k: string) => Ajuste,
  ) {
    const filas: any[] = []
    for (const g of cuales) {
      for (const p of porGrupo[g.key] ?? []) {
        filas.push({ dur: p.dur, symbol: p.symbol, [g.key]: p.y, __y: p.y, meta: p.meta })
      }
    }
    filas.sort((a, b) => a.dur - b.dur)
    const dys = desplazar(filas)
    filas.forEach((f, i) => { f.dy = dys[i] })

    let hayFit = false
    for (const g of cuales) {
      const pts = (porGrupo[g.key] ?? []).map((p) => ({ x: p.dur, y: p.y }))
      const fn = ajustar(pts, aj(g.key))
      if (fn && pts.length > 1) {
        hayFit = true
        const lo = Math.min(...pts.map((p) => p.x)), hi = Math.max(...pts.map((p) => p.x))
        for (let i = 0; i <= 60; i++) {
          const t = lo + ((hi - lo) * i) / 60
          filas.push({ dur: t, [`${g.key}__fit`]: fn(t) })
        }
      }
    }
    filas.sort((a, b) => a.dur - b.dur)
    return { filas, hayFit }
  }

  const spotData = useMemo(() => armar(
    grupos,
    Object.fromEntries(grupos.map((g) => [g.key,
      bonos[g.key].map((b) => ({ dur: b.dur, symbol: b.symbol, y: b.ytm, meta: b }))])),
    (k) => ({ ...ajSpot, grado: Math.min(ajSpot.grado, gradoTope(k)) }),
  ), [bonos, ajSpot, grupos])

  const fwdData = useMemo(() => Object.fromEntries(grupos.map((g) => [g.key, armar(
    [g],
    { [g.key]: tramos[g.key].map((t) => ({ dur: t.bono.dur, symbol: t.bono.symbol, y: t.fwd, meta: t })) },
    () => ({ ...ajFwd[g.key], grado: Math.min(ajFwd[g.key].grado, gradoTope(g.key)) }),
  )])), [tramos, ajFwd, grupos])

  /**
   * Spread de legislación: cociente de precios en dólares del ticker D, no
   * diferencia de TIR. GD30D / AL30D − 1 es lo que se cotiza en el mercado.
   */
  const pares = useMemo(() => {
    if (!spread || grupos.length < 2) return []
    const [a, b] = grupos
    return bonos[a.key]
      .map((x) => {
        const y = bonos[b.key].find((z) => z.vto && z.vto === x.vto)
        if (!y || !x.px || !y.px || x.px <= 0) return null
        return { local: x, ext: y, ratio: y.px / x.px - 1, par: `${y.symbol}D/${x.symbol}D` }
      })
      .filter(Boolean) as { local: Bono; ext: Bono; ratio: number; par: string }[]
  }, [bonos, grupos, spread])

  if (!grupos.reduce((n, g) => n + bonos[g.key].length, 0)) return null

  const Grafico = ({
    datos, cuales, tip, shortsVisibles, alto = 380,
  }: { datos: { filas: any[]; hayFit: boolean }; cuales: GrupoCurva[]; tip: any
       shortsVisibles?: boolean; alto?: number }) => {
    if (!datos.filas.length) {
      return <p className="py-12 text-center text-sm text-muted-foreground">Sin datos para graficar.</p>
    }
    const ds = datos.filas.map((f) => f.dur)
    const x0 = Math.min(...ds), x1 = Math.max(...ds)
    return (
      <ResponsiveContainer width="100%" height={alto}>
        <LineChart data={datos.filas} margin={{ top: 24, right: 28, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            type="number" dataKey="dur" domain={[x0 - 0.2, x1 + 0.2]}
            ticks={marcasX(x0, x1)}
            tickFormatter={(v: number) => `${v.toFixed(1)}y`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <YAxis
            width={52} tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)" domain={["auto", "auto"]}
          />
          <Tooltip content={tip} />
          {datos.hayFit && cuales.map((g) => (
            <Line key={`${g.key}-fit`} type="monotone" dataKey={`${g.key}__fit`} stroke={colores[g.key]}
              strokeWidth={2} dot={false} connectNulls isAnimationActive={false} legendType="none" />
          ))}
          {cuales.map((g) => (
            <Line key={g.key} type="linear" dataKey={g.key} name={g.nombre}
              stroke={datos.hayFit ? "transparent" : colores[g.key]}
              strokeWidth={2} connectNulls isAnimationActive={false}
              dot={<Punto dataKey={g.key} color={colores[g.key]} />} activeDot={{ r: 6 }} />
          ))}
          {shortsVisibles && cuales.map((g) => {
            const s = shortDe(g.key)
            return s ? (
              <ReferenceLine key={`r-${g.key}`} x={s.dur} stroke={colores[g.key]} strokeDasharray="3 4"
                strokeOpacity={0.6}
                label={{ value: `short ${s.symbol}`, position: "top", fontSize: 10, fill: colores[g.key] }} />
            ) : null
          })}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  const TipSpot = ({ active, payload }: any) => {
    const b: Bono | undefined = payload?.[0]?.payload?.meta
    if (!active || !b?.symbol) return null
    return (
      <div style={estiloTooltip} className="px-3 py-2">
        <div className="font-medium">{b.symbol}</div>
        <div className="text-muted-foreground">Vto. {b.vto ?? "—"}</div>
        <div className="tabular-nums">Duration {b.dur.toFixed(2)} años</div>
        <div className="font-medium tabular-nums">TIR {pct(b.ytm)}</div>
      </div>
    )
  }
  const TipFwd = ({ active, payload }: any) => {
    const t: Tramo | undefined = payload?.[0]?.payload?.meta
    if (!active || !t?.bono) return null
    return (
      <div style={estiloTooltip} className="px-3 py-2">
        <div className="font-medium">{t.short.symbol} → {t.bono.symbol}</div>
        <div className="tabular-nums text-muted-foreground">
          {t.short.dur.toFixed(2)}y · {pct(t.short.ytm)} → {t.bono.dur.toFixed(2)}y · {pct(t.bono.ytm)}
        </div>
        <div className="font-medium tabular-nums">Forward {pct(t.fwd)}</div>
      </div>
    )
  }

  const leyenda = (cuales: GrupoCurva[]) => (
    <div className="flex flex-wrap gap-4">
      {cuales.map((g) => (
        <span key={g.key} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-0.5 w-4 rounded" style={{ background: colores[g.key] }} />
          {g.nombre}
        </span>
      ))}
    </div>
  )

  const colorSpread = colores[grupos[grupos.length - 1].key]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-2">
            <CardTitle className="text-lg">{titulo} · curva spot</CardTitle>
            {leyenda(grupos)}
          </div>
          <Rueda ajuste={ajSpot} setAjuste={setAjSpot} maxGrado={gradoTopeTodos}
            grupos={grupos} colores={colores} setColor={setColor} />
        </CardHeader>
        <CardContent>
          <Grafico datos={spotData} cuales={grupos} tip={<TipSpot />} alto={420} />
        </CardContent>
      </Card>

      <div className={grupos.length > 1 ? "grid gap-6 lg:grid-cols-2" : ""}>
      {grupos.map((g) => (
        <Card key={g.key}>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-2">
              <CardTitle className="text-lg">
                Forward {grupos.length > 1 ? g.nombre.toLowerCase() : titulo.toLowerCase()}
              </CardTitle>
              {leyenda([g])}
            </div>
            <Rueda ajuste={ajFwd[g.key]} maxGrado={gradoTope(g.key)}
              setAjuste={(a) => setAjFwd((s) => ({ ...s, [g.key]: a }))}
              grupos={[g]} colores={colores} setColor={setColor}>
              <div className="space-y-2 border-t pt-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bono short
                </div>
                <Select
                  value={shortDe(g.key)?.symbol ?? ""}
                  onValueChange={(v) => setShort((s) => ({ ...s, [g.key]: v }))}
                  disabled={bonos[g.key].length < 2}
                >
                  <SelectTrigger className="tabular-nums"><SelectValue placeholder="Sin datos" /></SelectTrigger>
                  <SelectContent>
                    {bonos[g.key].slice(0, -1).map((b) => (
                      <SelectItem key={b.symbol} value={b.symbol} className="tabular-nums">
                        {b.symbol} · {b.dur.toFixed(1)}y · {pct(b.ytm)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los bonos más cortos que el short quedan fuera de la curva.
                </p>
              </div>
            </Rueda>
          </CardHeader>
          <CardContent>
            <Grafico datos={fwdData[g.key]} cuales={[g]} tip={<TipFwd />} shortsVisibles
              alto={grupos.length > 1 ? 400 : 380} />
          </CardContent>
        </Card>
      ))}
      </div>

      {spread && pares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{spread.titulo}</CardTitle>
            <CardDescription>{spread.descripcion}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pares} margin={{ top: 26, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="par" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)" interval={0} />
                <YAxis width={52} tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  content={({ active, payload }: any) => {
                    const p = payload?.[0]?.payload
                    if (!active || !p) return null
                    return (
                      <div style={estiloTooltip} className="px-3 py-2">
                        <div className="font-medium">{p.par}</div>
                        <div className="text-muted-foreground">Vto. {p.local.vto}</div>
                        <div className="tabular-nums">
                          {p.ext.px?.toFixed(2)} / {p.local.px?.toFixed(2)}
                        </div>
                        <div className="font-medium tabular-nums">Spread {pct(p.ratio)}</div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="ratio" fill={colorSpread} radius={[4, 4, 0, 0]}
                  maxBarSize={64} isAnimationActive={false}>
                  <LabelList dataKey="ratio" position="top" offset={8}
                    formatter={(v: number) => pct(v)}
                    style={{ fontSize: 11, fill: "var(--foreground)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Par</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">{grupos[0].nombre}</TableHead>
                  <TableHead className="text-right">{grupos[1].nombre}</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pares.map((p) => (
                  <TableRow key={p.local.symbol}>
                    <TableCell className="whitespace-nowrap font-medium">{p.par}</TableCell>
                    <TableCell>{p.local.vto}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.local.px?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.ext.px?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{pct(p.ratio)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
