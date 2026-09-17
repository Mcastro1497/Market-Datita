"use client"

/**
 * Panel de breakevens CER / tasa fija.
 *
 * Una fila por PAR (fija y CER al mismo vencimiento): inflación acumulada que
 * descuenta el par, la del tramo desde el par anterior, su mensual equivalente,
 * los meses de inflación que ese tramo cubre de verdad (corrido 45 días por el
 * rezago del CER) y lo que espera el REM para esa misma ventana.
 *
 * La cuenta vive en lib/breakeven.ts; acá sólo se arma la tabla y los gráficos.
 * No se persiste nada: son seis números que salen de `prices` y cambian con
 * cada tick.
 */

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import {
  REZAGO_CER_DIAS, cerConocido, claveMes, emparejar, fechaUtc, remEnVentana, sendaRem, tem, tramos,
  type AnioPct, type BonoBe, type MesPct, type PuntoCer, type Tramo,
} from "@/lib/breakeven"

export type RemData = {
  configurado: boolean
  fechaRem?: string | null
  mensual?: MesPct[]
  anual?: AnioPct[]
  observado?: MesPct[]
  cer?: PuntoCer[]
}

type Props = {
  fija: BonoBe[]
  /** Sin los cer_fixed. */
  cer: BonoBe[]
  /** CER que quedaron afuera por tener el CER del vencimiento ya publicado. */
  cerFijados: string[]
  fechaLiquidacion: string
  rem: RemData | null
}

type Fila = Tramo & {
  rem: { acum: number; mensual: number } | null
  /** REM acumulado liq → vto, para comparar con `acum`. */
  remAcum: number | null
}

const pct = (v: number | null | undefined, d = 2) =>
  v == null || !isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`
const pb = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${Math.round(v * 10000)}`
const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y.slice(2)}`
}
const diaMes = (d: Date) =>
  d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" })
const mesLargo = (ym: string) => {
  const [y, m] = ym.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" })
}

/**
 * Qué meses de IPC cubre la ventana. Un mes cuenta si la ventana toma al menos
 * la mitad de sus días; si no, aparecerían meses de los que sólo entra un
 * fin de semana. Si ninguno llega a la mitad (ventana de dos semanas), se
 * queda con el que más días aporta.
 */
function mesesCubiertos(desde: Date, hasta: Date): string {
  const partes: { k: string; frac: number }[] = []
  const cur = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1))
  while (cur < hasta) {
    const fin = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
    const dias = (fin.getTime() - cur.getTime()) / 86400000
    const en = (Math.min(fin.getTime(), hasta.getTime()) - Math.max(cur.getTime(), desde.getTime())) / 86400000
    if (en > 0) partes.push({ k: claveMes(cur), frac: en / dias })
    cur.setTime(fin.getTime())
  }
  let sel = partes.filter((p) => p.frac >= 0.5)
  if (!sel.length && partes.length) sel = [partes.reduce((a, b) => (b.frac > a.frac ? b : a))]
  if (!sel.length) return "—"
  const a = mesLargo(sel[0].k), b = mesLargo(sel[sel.length - 1].k)
  return a === b ? a : `${a} → ${b}`
}

const estiloTooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
}

export function BreakevenCerFija({ fija, cer, cerFijados, fechaLiquidacion, rem }: Props) {
  const liq = useMemo(() => fechaUtc(fechaLiquidacion), [fechaLiquidacion])
  const pares = useMemo(() => emparejar(fija, cer), [fija, cer])

  const senda = useMemo(() => {
    if (!rem?.configurado || !pares.length) return null
    return sendaRem(rem.observado ?? [], rem.mensual ?? [], rem.anual ?? [], pares[pares.length - 1].vto.slice(0, 7))
  }, [rem, pares])

  const conocido = useMemo(() => cerConocido(rem?.cer ?? [], liq), [rem, liq])

  const filas = useMemo<Fila[]>(() => {
    const ts = tramos(pares, liq, conocido)
    const liqCorrida = new Date(liq.getTime() - REZAGO_CER_DIAS * 86400000)
    return ts.map((t) => ({
      ...t,
      rem: senda && !t.determinado ? remEnVentana(senda, t.ventana.desde, t.ventana.hasta) : null,
      remAcum: senda ? (remEnVentana(senda, liqCorrida, t.ventana.hasta)?.acum ?? null) : null,
    }))
  }, [pares, liq, conocido, senda])
  const determinados = filas.filter((f) => f.determinado).map((f) => `${f.par.fija.symbol}/${f.par.cer.symbol}`)

  const sinPar = fija.filter((f) => !pares.some((p) => p.fija.symbol === f.symbol)).map((f) => f.symbol)
  const ultimoIpc = rem?.observado?.length ? rem.observado[rem.observado.length - 1] : null
  // El primer mes del REM que el INDEC todavía no publicó.
  const remProximo = (rem?.mensual ?? []).find((m) => !ultimoIpc || m.mes > ultimoIpc.mes) ?? null
  const vivas = filas.filter((f) => !f.determinado)
  const primero = vivas[0], ultimo = vivas[vivas.length - 1]
  const kpis = [
    { titulo: primero ? `Breakeven ${primero.par.fija.symbol}/${primero.par.cer.symbol}` : "Par más corto", valor: primero ? tem(primero.be) : null, nota: primero ? `TEM · vence ${fechaCorta(primero.par.vto)}` : "" },
    { titulo: ultimo ? `Breakeven ${ultimo.par.fija.symbol}/${ultimo.par.cer.symbol}` : "Par más largo", valor: ultimo ? tem(ultimo.be) : null, nota: ultimo ? `TEM · vence ${fechaCorta(ultimo.par.vto)}` : "" },
    { titulo: "Último IPC", valor: ultimoIpc ? ultimoIpc.valor / 100 : null, nota: ultimoIpc ? `INDEC, ${mesLargo(ultimoIpc.mes)}` : "sin dato" },
    { titulo: "REM próximo dato", valor: remProximo ? remProximo.valor / 100 : null, nota: remProximo ? `mediana para ${mesLargo(remProximo.mes)}` : "sin dato" },
  ]

  const datos = filas.filter((f) => !f.determinado).map((f) => ({
    par: `${f.par.fija.symbol}/${f.par.cer.symbol}`,
    beTem: tem(f.be),
    remTem: f.remAcum != null ? Math.pow(1 + f.remAcum, 1 / (f.par.dur * 12)) - 1 : null,
    tramo: f.tramoMensual,
    remTramo: f.rem?.mensual ?? null,
    meta: f,
  }))

  if (!vivas.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay pares fija / CER con el mismo vencimiento y TIR cargada.
        </CardContent>
      </Card>
    )
  }

  const TipBe = ({ active, payload }: any) => {
    const f: Fila | undefined = payload?.[0]?.payload?.meta
    if (!active || !f) return null
    return (
      <div style={estiloTooltip} className="px-3 py-2 space-y-0.5">
        <div className="font-medium">{f.par.fija.symbol} / {f.par.cer.symbol}</div>
        <div className="text-muted-foreground">Vto. {fechaCorta(f.par.vto)} · {f.par.dur.toFixed(2)} años</div>
        <div className="tabular-nums">Nominal {pct(f.par.fija.ytm)} · Real {pct(f.par.cer.ytm)}</div>
        <div className="font-medium tabular-nums">Breakeven {pct(tem(f.be))} mensual · {pct(f.acum, 1)} acumulado</div>
        {f.remAcum != null && <div className="tabular-nums">REM acumulado {pct(f.remAcum, 1)}</div>}
      </div>
    )
  }
  const TipTramo = ({ active, payload }: any) => {
    const f: Fila | undefined = payload?.[0]?.payload?.meta
    if (!active || !f) return null
    return (
      <div style={estiloTooltip} className="px-3 py-2 space-y-0.5">
        <div className="font-medium">{fechaCorta(f.inicio.toISOString().slice(0, 10))} → {fechaCorta(f.par.vto)}</div>
        <div className="text-muted-foreground">Inflación de {mesesCubiertos(f.ventana.desde, f.ventana.hasta)}</div>
        <div className="font-medium tabular-nums">Implícita {pct(f.tramo)} en el tramo · {pct(f.tramoMensual)} mensual</div>
        {f.rem && <div className="tabular-nums">REM {pct(f.rem.acum)} · {pct(f.rem.mensual)} mensual</div>}
      </div>
    )
  }

  const ejeX = <XAxis dataKey="par" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" interval={0} angle={-30} textAnchor="end" height={56} />
  const ejeY = <YAxis width={52} tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" domain={["auto", "auto"]} />
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
          <CardTitle className="text-lg">Breakevens por par</CardTitle>
          <CardDescription>
            Fija y CER al mismo vencimiento. Liquidación {fechaCorta(fechaLiquidacion)}.
            {conocido
              ? <> CER publicado hasta el {fechaCorta(conocido.hasta.toISOString().slice(0, 10))} ({pct(conocido.factor - 1)} desde la liquidación): ese tramo es dato y no entra en la implícita.</>
              : <> Sin serie CER: se asume que nada del CER está publicado.</>}
            {" "}La columna "Inflación de" corre la ventana {REZAGO_CER_DIAS} días por el rezago del CER: el CER del 15/11 es el IPC de septiembre.
            {rem?.fechaRem && <> REM de {mesLargo(rem.fechaRem.slice(0, 7))}.</>}
            {(cerFijados.length > 0 || determinados.length > 0) && <> Afuera por CER ya publicado: {[...cerFijados, ...determinados].join(", ")}.</>}
            {sinPar.length > 0 && <> Fijas sin par: {sinPar.join(", ")}.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Par</TableHead>
                <TableHead>Vto.</TableHead>
                <TableHead className="text-right">TIR nominal</TableHead>
                <TableHead className="text-right">TIR real</TableHead>
                <TableHead className="text-right">BE TEM</TableHead>
                <TableHead className="text-right">BE acum.</TableHead>
                <TableHead>Tramo desde</TableHead>
                <TableHead className="text-right">Tramo</TableHead>
                <TableHead className="text-right">Tramo TEM</TableHead>
                <TableHead>Inflación de</TableHead>
                <TableHead className="text-right">REM tramo</TableHead>
                <TableHead className="text-right">Δ TEM (pb)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.filter((f) => !f.determinado).map((f) => {
                const delta = f.rem && f.tramoMensual != null ? f.tramoMensual - f.rem.mensual : null
                return (
                  <TableRow key={f.par.vto}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {f.par.fija.symbol} <span className="text-muted-foreground font-normal">/ {f.par.cer.symbol}</span>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{fechaCorta(f.par.vto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.par.fija.ytm)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.par.cer.ytm)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(tem(f.be))}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.acum, 1)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                      {fechaCorta(f.inicio.toISOString().slice(0, 10))}
                      {!f.desde && conocido && f.inicio.getTime() === conocido.hasta.getTime() && <span className="ml-1 text-[10px] uppercase">cer</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.tramo)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{pct(f.tramoMensual)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground" title={`${diaMes(f.ventana.desde)} → ${diaMes(f.ventana.hasta)}`}>
                      {mesesCubiertos(f.ventana.desde, f.ventana.hasta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{pct(f.rem?.mensual)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${delta == null ? "" : delta > 0 ? "text-destructive" : "text-success"}`}>{pb(delta)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Tramo: inflación implícita entre "Tramo desde" y el vencimiento, (1 + acum.) / (1 + acum. anterior) − 1. Para el
            primer par, el denominador es el CER ya publicado, no la liquidación. Δ positivo: el mercado descuenta más
            inflación que el REM para esos meses.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Inflación implícita por tramo</CardTitle>
            {leyenda([{ color: "var(--chart-1)", nombre: "Implícita del tramo, mensual" }, ...(senda ? [{ color: "#c2410c", nombre: "REM del tramo", punteada: true }] : [])])}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={datos} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                {ejeX}{ejeY}
                <Tooltip content={<TipTramo />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                {lineaIpc}
                <Bar dataKey="tramo" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                {senda && <Line type="monotone" dataKey="remTramo" stroke="#c2410c" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Breakeven mensual por par</CardTitle>
            {leyenda([{ color: "var(--chart-4)", nombre: "Breakeven TEM, liquidación → vto." }, ...(senda ? [{ color: "#c2410c", nombre: "REM mismo plazo", punteada: true }] : [])])}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={datos} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                {ejeX}{ejeY}
                <Tooltip content={<TipBe />} />
                {lineaIpc}
                {senda && <Line type="monotone" dataKey="remTem" stroke="#c2410c" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
                <Line type="monotone" dataKey="beTem" stroke="var(--chart-4)" strokeWidth={2} isAnimationActive={false}
                  dot={{ r: 4, fill: "var(--chart-4)", stroke: "var(--background)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
