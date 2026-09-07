"use client"

/**
 * Curva spot y forwards de los soberanos hard dollar, separados por legislación.
 *
 * POR QUÉ NO HAY TABLA EN LA BASE
 * Todo esto sale de `prices` (ytm, duration_y) e `instruments` (legislacion), que
 * la página ya trae. Son unas decenas de potencias: guardarlas sería duplicar dato
 * derivado que además queda desincronizado del precio en cuanto se mueve la rueda.
 * Se recalcula en cada refresco de SWR. Si algún día hace falta el histórico —cómo
 * era la curva hace un mes— ahí sí hay que persistir, porque `prices` sólo guarda
 * el estado actual.
 *
 * POR QUÉ SEPARADAS POR LEGISLACIÓN
 * AL30 y GD30 tienen el mismo flujo, el mismo emisor y el mismo vencimiento, y
 * cotizan distinto: la diferencia es riesgo de jurisdicción. Metidos en la misma
 * curva, ese spread se lee como si fuera plazo.
 */

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"

type Bono = { symbol: string; dur: number; ytm: number; px: number | null; vto: string | null }
type Tramo = { short: Bono; bono: Bono; dt: number; fwd: number }

const LEYES = [
  { key: "arg", nombre: "Argentina",  color: "#2563eb" },
  { key: "ny",  nombre: "Nueva York", color: "#ea580c" },
] as const
type LeyKey = (typeof LEYES)[number]["key"]

const pct = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || !isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`
const bps = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)} bps`

/** F(1,2) = [ (1+R2)^t2 / (1+R1)^t1 ] ^ ( 1/(t2-t1) ) - 1 */
function forward(a: Bono, b: Bono): number {
  return Math.pow(Math.pow(1 + b.ytm, b.dur) / Math.pow(1 + a.ytm, a.dur), 1 / (b.dur - a.dur)) - 1
}

/** Etiquetas: AL30 y AO28 caen a 0,036 años una de otra y se pisarían. */
function desplazar(pts: { dur: number }[]): number[] {
  let previa = -Infinity
  let abajo = false
  return pts.map((p) => {
    abajo = p.dur - previa < 0.12 ? !abajo : false
    previa = p.dur
    return abajo ? 18 : -10
  })
}

function Punto(props: any) {
  const { cx, cy, payload, dataKey, color } = props
  const y = payload?.[dataKey]
  if (y === null || y === undefined || cx === undefined || cy === undefined) return null
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

const ejeX = {
  type: "number" as const,
  dataKey: "dur",
  domain: ["dataMin - 0.3", "dataMax + 0.3"] as [string, string],
  tickFormatter: (v: number) => `${v}y`,
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  stroke: "var(--border)",
}
const ejeY = {
  width: 52,
  tickFormatter: (v: number) => `${(v * 100).toFixed(0)}%`,
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  stroke: "var(--border)",
  domain: ["auto", "auto"] as [string, string],
}
const estiloTooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
}

export function CurvaForward({ flows }: { flows: any[] }) {
  const bonos = useMemo(() => {
    const out: Record<LeyKey, Bono[]> = { arg: [], ny: [] }
    for (const f of flows) {
      const leg = f?.details?.legislacion
      const key: LeyKey | null = leg === "Argentina" ? "arg" : leg === "Nueva York" ? "ny" : null
      const ytm = f?.lastPrice?.ytm
      const dur = f?.lastPrice?.duration_y
      if (!key || ytm === null || ytm === undefined || dur === null || dur === undefined) continue
      if (!(Number(dur) > 0)) continue
      out[key].push({
        symbol: f.ticker,
        dur: Number(dur),
        ytm: Number(ytm),
        px: f?.lastPrice?.closing_price ?? f?.lastPrice?.last ?? null,
        vto: f?.details?.vencimiento ?? null,
      })
    }
    out.arg.sort((a, b) => a.dur - b.dur)
    out.ny.sort((a, b) => a.dur - b.dur)
    return out
  }, [flows])

  const [short, setShort] = useState<Record<LeyKey, string>>({ arg: "", ny: "" })
  const shortDe = (k: LeyKey) =>
    bonos[k].find((b) => b.symbol === short[k]) ?? bonos[k][0] ?? null

  const tramos = useMemo(() => {
    const out: Record<LeyKey, Tramo[]> = { arg: [], ny: [] }
    for (const { key } of LEYES) {
      const B = bonos[key]
      const s = shortDe(key)
      if (!s) continue
      const i = B.findIndex((b) => b.symbol === s.symbol)
      for (let j = i + 1; j < B.length; j++) {
        out[key].push({ short: s, bono: B[j], dt: B[j].dur - s.dur, fwd: forward(s, B[j]) })
      }
    }
    return out
  }, [bonos, short])

  // Una fila por duration, con la TIR de cada ley donde exista. connectNulls une
  // los puntos de cada serie salteando las filas de la otra.
  const datosSpot = useMemo(() => {
    const filas = [
      ...bonos.arg.map((b) => ({ dur: b.dur, symbol: b.symbol, arg: b.ytm, ny: null as number | null, bono: b })),
      ...bonos.ny.map((b) => ({ dur: b.dur, symbol: b.symbol, arg: null as number | null, ny: b.ytm, bono: b })),
    ].sort((a, b) => a.dur - b.dur)
    const dys = desplazar(filas)
    return filas.map((f, i) => ({ ...f, dy: dys[i] }))
  }, [bonos])

  const datosFwd = useMemo(() => {
    const filas = [
      ...tramos.arg.map((t) => ({ dur: t.bono.dur, symbol: t.bono.symbol, arg: t.fwd, ny: null as number | null, tramo: t })),
      ...tramos.ny.map((t) => ({ dur: t.bono.dur, symbol: t.bono.symbol, arg: null as number | null, ny: t.fwd, tramo: t })),
    ].sort((a, b) => a.dur - b.dur)
    const dys = desplazar(filas)
    return filas.map((f, i) => ({ ...f, dy: dys[i] }))
  }, [tramos])

  // Mismo vencimiento en las dos leyes: la diferencia de TIR es jurisdicción pura.
  const pares = useMemo(() => {
    return bonos.arg
      .map((a) => {
        const n = bonos.ny.find((x) => x.vto && x.vto === a.vto)
        return n ? { a, n, bps: (a.ytm - n.ytm) * 10000 } : null
      })
      .filter(Boolean) as { a: Bono; n: Bono; bps: number }[]
  }, [bonos])

  const filasTramos = useMemo(
    () => LEYES.flatMap(({ key, nombre }) => tramos[key].map((t) => ({ t, ley: nombre, key })))
             .sort((x, y) => x.t.bono.dur - y.t.bono.dur),
    [tramos],
  )

  if (!bonos.arg.length && !bonos.ny.length) return null

  const TipSpot = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const b: Bono = payload[0].payload.bono
    return (
      <div style={estiloTooltip} className="px-3 py-2">
        <div className="font-medium">{b.symbol}</div>
        <div className="text-muted-foreground">Vto. {b.vto ?? "—"}</div>
        <div className="tabular-nums">Duration {b.dur.toFixed(3)} años</div>
        <div className="tabular-nums font-medium">TIR {pct(b.ytm)}</div>
      </div>
    )
  }
  const TipFwd = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const t: Tramo = payload[0].payload.tramo
    return (
      <div style={estiloTooltip} className="px-3 py-2">
        <div className="font-medium">{t.short.symbol} → {t.bono.symbol}</div>
        <div className="tabular-nums text-muted-foreground">
          {t.short.dur.toFixed(2)}y · {pct(t.short.ytm)} → {t.bono.dur.toFixed(2)}y · {pct(t.bono.ytm)}
        </div>
        <div className="tabular-nums">Tramo {t.dt.toFixed(3)} años</div>
        <div className="tabular-nums font-medium">Forward {pct(t.fwd)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Curva y forwards por legislación</CardTitle>
          <CardDescription>
            Se calcula en vivo sobre el precio del momento, sin persistir nada. Cada bono
            se ubica en su duration de Macaulay, y el forward de cada uno se mide contra el
            short de su propia legislación. Ley Argentina y ley Nueva York van por separado:
            comparten flujo y emisor, así que mezclarlas leería el riesgo de jurisdicción
            como si fuera plazo.
          </CardDescription>
          <div className="flex flex-wrap gap-4 pt-3">
            {LEYES.map(({ key, nombre, color }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  Short ley {nombre}
                </div>
                <Select
                  value={shortDe(key)?.symbol ?? ""}
                  onValueChange={(v) => setShort((s) => ({ ...s, [key]: v }))}
                  disabled={bonos[key].length < 2}
                >
                  <SelectTrigger className="w-[230px] tabular-nums">
                    <SelectValue placeholder="Sin datos" />
                  </SelectTrigger>
                  <SelectContent>
                    {bonos[key].slice(0, -1).map((b) => (
                      <SelectItem key={b.symbol} value={b.symbol} className="tabular-nums">
                        {b.symbol} · {b.dur.toFixed(2)}y · {pct(b.ytm)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <p className="self-end pb-2 text-xs text-muted-foreground max-w-[280px]">
              Los bonos más cortos que el short quedan fuera de la curva forward.
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Curva spot</CardTitle>
          <CardDescription>TIR de cada bono contra su duration de Macaulay.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={datosSpot} margin={{ top: 24, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis {...ejeX} />
              <YAxis {...ejeY} />
              <Tooltip content={<TipSpot />} />
              {LEYES.map(({ key, nombre, color }) => (
                <Line key={key} type="linear" dataKey={key} name={`Ley ${nombre}`} stroke={color}
                  strokeWidth={2} connectNulls isAnimationActive={false}
                  dot={<Punto dataKey={key} color={color} />} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Curvas forward</CardTitle>
          <CardDescription className="tabular-nums">
            Tasa implícita entre el short de cada legislación y ese bono. Short ley Argentina:{" "}
            {shortDe("arg")?.symbol ?? "—"} · short ley Nueva York: {shortDe("ny")?.symbol ?? "—"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={datosFwd} margin={{ top: 24, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis {...ejeX} />
              <YAxis {...ejeY} />
              <Tooltip content={<TipFwd />} />
              {LEYES.map(({ key, color }) => {
                const s = shortDe(key)
                return s ? (
                  <ReferenceLine key={`r-${key}`} x={s.dur} stroke={color} strokeDasharray="3 4"
                    strokeOpacity={0.5}
                    label={{ value: `short ${s.symbol}`, position: "top", fontSize: 10, fill: color }} />
                ) : null
              })}
              {LEYES.map(({ key, nombre, color }) => (
                <Line key={key} type="linear" dataKey={key} name={`Ley ${nombre}`} stroke={color}
                  strokeWidth={2} connectNulls isAnimationActive={false}
                  dot={<Punto dataKey={key} color={color} />} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forward de cada bono contra su short</CardTitle>
          <CardDescription>
            F₁,₂ = [ (1+R₂)^t₂ / (1+R₁)^t₁ ] ^ ( 1 / (t₂ − t₁) ) − 1, con t = duration de Macaulay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tramo</TableHead>
                <TableHead>Legislación</TableHead>
                <TableHead className="text-right">t₁</TableHead>
                <TableHead className="text-right">t₂</TableHead>
                <TableHead className="text-right">Δt</TableHead>
                <TableHead className="text-right">R₁</TableHead>
                <TableHead className="text-right">R₂</TableHead>
                <TableHead className="text-right">Forward</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasTramos.map(({ t, ley, key }) => (
                <TableRow key={`${key}-${t.bono.symbol}`}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full"
                        style={{ background: LEYES.find((l) => l.key === key)!.color }} />
                      {t.short.symbol} → {t.bono.symbol}
                    </span>
                  </TableCell>
                  <TableCell>{ley}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.short.dur.toFixed(3)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.bono.dur.toFixed(3)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.dt.toFixed(3)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(t.short.ytm)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(t.bono.ytm)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{pct(t.fwd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spread de legislación, par contra par</CardTitle>
            <CardDescription>
              Bonos con vencimiento idéntico en las dos leyes. Mismo flujo, mismo emisor,
              misma fecha: la diferencia de TIR es riesgo de jurisdicción y nada más, sin
              interpolar ninguna curva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Par</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">TIR ley Argentina</TableHead>
                  <TableHead className="text-right">TIR ley Nueva York</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pares.map(({ a, n, bps: b }) => (
                  <TableRow key={a.symbol}>
                    <TableCell className="font-medium whitespace-nowrap">{a.symbol} / {n.symbol}</TableCell>
                    <TableCell>{a.vto}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(a.ytm)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(n.ytm)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{bps(b)}</TableCell>
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
