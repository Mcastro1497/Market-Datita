"use client"

/**
 * Panel de breakevens CER / tasa fija.
 *
 * Una fila por bono fija: contra qué CER se compara, la inflación que iguala a
 * los dos (breakeven, en TEA y en TEM), la inflación implícita del tramo desde
 * la fija anterior (forward) y lo que espera el REM para la misma ventana.
 *
 * La cuenta vive en lib/breakeven.ts; acá sólo se arma la tabla y los gráficos.
 * Como en curva-forward, no se persiste nada: son doce números que salen de
 * `prices` y cambian con cada tick.
 */

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import {
  breakeven, forwardBe, realEn, remEntre, sendaRem, tem,
  type AnioPct, type BonoBe, type MesPct, type ModoReal,
} from "@/lib/breakeven"

export type RemData = {
  configurado: boolean
  fechaRem?: string | null
  mensual?: MesPct[]
  anual?: AnioPct[]
  observado?: MesPct[]
}

type Props = {
  fija: BonoBe[]
  /** Sin los cer_fixed y ordenados por duration. */
  cer: BonoBe[]
  /** CER que quedaron afuera por tener el CER del vencimiento ya publicado. */
  cerFijados: string[]
  fechaLiquidacion: string
  rem: RemData | null
}

type Fila = {
  bono: BonoBe
  refCer: string
  modo: ModoReal
  real: number
  be: number
  beTem: number
  fwdTem: number | null
  remTem: number | null
  remTramoTem: number | null
  /** Ticker de la fija anterior, que abre el tramo del forward. */
  desde: string | null
}

const pct = (v: number | null | undefined, d = 2) =>
  v == null || !isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`
const pb = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${Math.round(v * 10000)}`
const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y.slice(2)}`
}
const mesLargo = (ym: string) => {
  const [y, m] = ym.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" })
}

const MODO: Record<ModoReal, { texto: string; titulo: string; clase: string }> = {
  par:    { texto: "par",    titulo: "CER con el mismo vencimiento", clase: "bg-primary/10 text-primary border-transparent" },
  interp: { texto: "interp", titulo: "Interpolado entre los dos CER vecinos por duration", clase: "bg-muted text-muted-foreground border-transparent" },
  borde:  { texto: "borde",  titulo: "Fuera del rango de la curva CER: se usa el más cercano, sin extrapolar", clase: "bg-destructive/10 text-destructive border-transparent" },
}

const estiloTooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
}

/** Interpola el breakeven mensual a una duration dada; null fuera del rango. */
function beEn(filas: Fila[], dur: number): number | null {
  if (filas.length < 2 || dur < filas[0].bono.dur || dur > filas[filas.length - 1].bono.dur) return null
  for (let i = 1; i < filas.length; i++) {
    const a = filas[i - 1], b = filas[i]
    if (dur <= b.bono.dur) {
      const w = (dur - a.bono.dur) / (b.bono.dur - a.bono.dur || 1)
      return a.beTem + w * (b.beTem - a.beTem)
    }
  }
  return null
}

export function BreakevenCerFija({ fija, cer, cerFijados, fechaLiquidacion, rem }: Props) {
  const liq = useMemo(() => new Date(`${fechaLiquidacion}T00:00:00Z`), [fechaLiquidacion])

  const senda = useMemo(() => {
    if (!rem?.configurado) return null
    const ultimoVto = fija.reduce((m, b) => (b.vto > m ? b.vto : m), "")
    return sendaRem(rem.observado ?? [], rem.mensual ?? [], rem.anual ?? [], ultimoVto.slice(0, 7))
  }, [rem, fija])

  const filas = useMemo<Fila[]>(() => {
    const ordenadas = [...fija].sort((a, b) => a.dur - b.dur)
    const out: Fila[] = []
    for (const bono of ordenadas) {
      const r = realEn(cer, bono.dur, bono.vto)
      if (!r) continue
      const be = breakeven(bono.ytm, r.ytm)
      const prev = out[out.length - 1]
      const fwd = prev ? forwardBe(prev.be, prev.bono.dur, be, bono.dur) : be
      const vto = new Date(`${bono.vto}T00:00:00Z`)
      out.push({
        bono, refCer: r.ref, modo: r.modo, real: r.ytm, be, beTem: tem(be),
        fwdTem: fwd == null ? null : tem(fwd),
        remTem: senda ? remEntre(senda, liq, vto) : null,
        remTramoTem: senda
          ? remEntre(senda, prev ? new Date(`${prev.bono.vto}T00:00:00Z`) : liq, vto)
          : null,
        desde: prev?.bono.symbol ?? null,
      })
    }
    return out
  }, [fija, cer, senda, liq])

  const ultimoIpc = rem?.observado?.length ? rem.observado[rem.observado.length - 1] : null
  const kpis = [
    { titulo: "Breakeven 3 meses", valor: beEn(filas, 0.25), nota: "TEM, interpolado a 0,25 años" },
    { titulo: "Breakeven 6 meses", valor: beEn(filas, 0.5), nota: "TEM, interpolado a 0,5 años" },
    { titulo: "Breakeven 12 meses", valor: beEn(filas, 1), nota: "TEM, interpolado a 1 año" },
    {
      titulo: "Último IPC",
      valor: ultimoIpc ? ultimoIpc.valor / 100 : null,
      nota: ultimoIpc ? `INDEC, ${mesLargo(ultimoIpc.mes)}` : "sin dato",
    },
  ]

  const datos = filas.map((f) => ({
    symbol: f.bono.symbol,
    be: f.beTem,
    rem: f.remTem,
    fwd: f.fwdTem,
    remTramo: f.remTramoTem,
    meta: f,
  }))

  if (!filas.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sin bonos fija o CER con TIR para calcular breakevens.
        </CardContent>
      </Card>
    )
  }

  const TipBe = ({ active, payload }: any) => {
    const f: Fila | undefined = payload?.[0]?.payload?.meta
    if (!active || !f) return null
    return (
      <div style={estiloTooltip} className="px-3 py-2 space-y-0.5">
        <div className="font-medium">{f.bono.symbol} <span className="text-muted-foreground">vs {f.refCer}</span></div>
        <div className="text-muted-foreground">Vto. {fechaCorta(f.bono.vto)} · {f.bono.dur.toFixed(2)} años</div>
        <div className="tabular-nums">Nominal {pct(f.bono.ytm)} · Real {pct(f.real)}</div>
        <div className="font-medium tabular-nums">Breakeven {pct(f.beTem)} mensual · {pct(f.be, 1)} anual</div>
        {f.remTem != null && <div className="tabular-nums">REM {pct(f.remTem)} mensual · {pb(f.beTem - f.remTem)} pb</div>}
      </div>
    )
  }
  const TipFwd = ({ active, payload }: any) => {
    const f: Fila | undefined = payload?.[0]?.payload?.meta
    if (!active || !f) return null
    return (
      <div style={estiloTooltip} className="px-3 py-2 space-y-0.5">
        <div className="font-medium">{f.desde ?? "Liquidación"} → {f.bono.symbol}</div>
        <div className="font-medium tabular-nums">Implícita {pct(f.fwdTem)} mensual</div>
        {f.remTramoTem != null && <div className="tabular-nums">REM del tramo {pct(f.remTramoTem)} mensual</div>}
      </div>
    )
  }

  const ejeX = (
    <XAxis dataKey="symbol" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" interval={0} angle={-35} textAnchor="end" height={48} />
  )
  const ejeY = (
    <YAxis width={52} tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" domain={["auto", "auto"]} />
  )
  const lineaIpc = ultimoIpc ? (
    <ReferenceLine y={ultimoIpc.valor / 100} stroke="var(--muted-foreground)" strokeDasharray="3 4"
      label={{ value: `IPC ${mesLargo(ultimoIpc.mes)}`, position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }} />
  ) : null

  const leyenda = (items: { color: string; nombre: string; punteada?: boolean }[]) => (
    <div className="flex flex-wrap gap-4">
      {items.map((i) => (
        <span key={i.nombre} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          {i.punteada
            ? <span className="w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
            : <span className="h-0.5 w-4 rounded" style={{ background: i.color }} />}
          {i.nombre}
        </span>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.titulo}>
            <CardHeader className="pb-2">
              <CardDescription>{k.titulo}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{pct(k.valor)}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">{k.nota}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Breakevens por bono</CardTitle>
          <CardDescription>
            Inflación que iguala el rendimiento de cada fija con el CER de su plazo. Liquidación {fechaCorta(fechaLiquidacion)}.
            {rem?.fechaRem && <> REM de {mesLargo(rem.fechaRem.slice(0, 7))}, ventana corrida 45 días por el rezago del CER.</>}
            {cerFijados.length > 0 && <> Afuera por CER ya fijado: {cerFijados.join(", ")}.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fija</TableHead>
                <TableHead>Vto.</TableHead>
                <TableHead className="text-right">Dur.</TableHead>
                <TableHead className="text-right">TIR nominal</TableHead>
                <TableHead>CER ref.</TableHead>
                <TableHead className="text-right">TIR real</TableHead>
                <TableHead className="text-right">Breakeven TEA</TableHead>
                <TableHead className="text-right">Breakeven TEM</TableHead>
                <TableHead className="text-right">Implícita tramo</TableHead>
                <TableHead className="text-right">REM TEM</TableHead>
                <TableHead className="text-right">Δ vs REM (pb)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => {
                const m = MODO[f.modo]
                const delta = f.remTem == null ? null : f.beTem - f.remTem
                return (
                  <TableRow key={f.bono.symbol}>
                    <TableCell className="font-medium">{f.bono.symbol}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{fechaCorta(f.bono.vto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.bono.dur.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.bono.ytm)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="tabular-nums">{f.refCer}</span>
                        <Badge variant="outline" title={m.titulo} className={`px-1.5 py-0 text-[10px] font-normal ${m.clase}`}>{m.texto}</Badge>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.real)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.be, 1)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{pct(f.beTem)}</TableCell>
                    <TableCell className="text-right tabular-nums" title={f.desde ? `${f.desde} → ${f.bono.symbol}` : `Liquidación → ${f.bono.symbol}`}>{pct(f.fwdTem)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{pct(f.remTem)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${delta == null ? "" : delta > 0 ? "text-destructive" : "text-success"}`}>{pb(delta)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Δ positivo: el mercado descuenta más inflación que el REM (la fija paga de más, o el CER está caro). Negativo: al revés.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Breakeven mensual por vencimiento</CardTitle>
            {leyenda([{ color: "var(--chart-1)", nombre: "Breakeven" }, ...(senda ? [{ color: "#c2410c", nombre: "REM", punteada: true }] : [])])}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={datos} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                {ejeX}{ejeY}
                <Tooltip content={<TipBe />} />
                {lineaIpc}
                {senda && <Line type="monotone" dataKey="rem" stroke="#c2410c" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
                <Line type="monotone" dataKey="be" stroke="var(--chart-1)" strokeWidth={2} isAnimationActive={false}
                  dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--background)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Inflación implícita por tramo</CardTitle>
            {leyenda([{ color: "var(--chart-2)", nombre: "Implícita entre fijas consecutivas" }, ...(senda ? [{ color: "#c2410c", nombre: "REM del tramo", punteada: true }] : [])])}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={datos} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                {ejeX}{ejeY}
                <Tooltip content={<TipFwd />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                {lineaIpc}
                <Bar dataKey="fwd" fill="var(--chart-2)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                {senda && <Line type="monotone" dataKey="remTramo" stroke="#c2410c" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
