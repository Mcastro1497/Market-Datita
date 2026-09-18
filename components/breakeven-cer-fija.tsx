"use client"

/**
 * Panel de breakevens CER / tasa fija.
 *
 * Una fila por PAR (fija y CER al mismo vencimiento): inflación acumulada que
 * descuenta el par, qué meses de IPC despeja ese par una vez descontado el CER
 * ya publicado y los meses que fijaron los pares anteriores, el IPC mensual
 * implícito de esos meses y lo que espera el REM para los mismos.
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
  DIAS_MINIMOS, bootstrap, cerConocido, emparejar, fechaUtc, iso, remEnBloques, sendaRem, significativos, tem,
  type AnioPct, type BonoBe, type Fila as FilaBe, type MesPct, type PuntoCer, type Tramo,
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
  /** liq − 10 hábiles: el CER que ya devengó el bono a la liquidación. */
  fechaCerAplicable: string
  rem: RemData | null
}

type Fila = FilaBe & {
  /** REM mensual para los mismos bloques que despeja el par. */
  rem: number | null
  /** REM sobre todo el δ del par (fijados y nuevos), mensual, para el gráfico por par. */
  remDelta: number | null
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

/** "sept 26" o "oct 26 → dic 26": los meses de IPC que despeja el par. */
function etiquetaBloques(tramos: Tramo[]): string {
  if (!tramos.length) return "—"
  const sig = significativos(tramos)
  const a = mesLargo(sig[0].mes), b = mesLargo(sig[sig.length - 1].mes)
  return a === b ? a : `${a} → ${b}`
}
/** "31 de 31 días" o "31 + 15 días": cuánto CER aporta cada bloque nuevo. */
const diasDe = (tramos: Tramo[]) =>
  tramos.length === 1 ? `${tramos[0].enTramo} de ${tramos[0].dias} días` : tramos.map((t) => t.enTramo).join(" + ") + " días"

const estiloTooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
}

export function BreakevenCerFija({ fija, cer, cerFijados, fechaLiquidacion, fechaCerAplicable, rem }: Props) {
  const pares = useMemo(() => emparejar(fija, cer), [fija, cer])
  const conocido = useMemo(() => cerConocido(rem?.cer ?? [], fechaUtc(fechaCerAplicable)), [rem, fechaCerAplicable])
  const base = useMemo(() => bootstrap(pares, conocido), [pares, conocido])

  const senda = useMemo(() => {
    if (!rem?.configurado || !base.length) return null
    const ultimoMes = base.flatMap((f) => [...f.fijados, ...f.nuevos].map((t) => t.mes)).sort().pop()
    return ultimoMes ? sendaRem(rem.observado ?? [], rem.mensual ?? [], rem.anual ?? [], ultimoMes) : null
  }, [rem, base])

  const filas = useMemo<Fila[]>(() => base.map((f) => ({
    ...f,
    rem: senda && !f.determinado ? remEnBloques(senda, f.nuevos) : null,
    remDelta: senda && !f.determinado ? remEnBloques(senda, [...f.fijados, ...f.nuevos]) : null,
  })), [base, senda])
  const nombre = (f: Fila) => `${f.par.fija.symbol}/${f.par.cer.symbol}`
  const determinados = filas.filter((f) => f.determinado).map(nombre)
  // Un par que sólo despeja uno o dos días de CER no dice nada: afuera de la tabla, avisado en la leyenda.
  const escasos = filas.filter((f) => !f.determinado && f.escasa).map((f) => `${nombre(f)} (${f.diasNuevos} día${f.diasNuevos === 1 ? "" : "s"})`)

  const sinPar = fija.filter((f) => !pares.some((p) => p.fija.symbol === f.symbol)).map((f) => f.symbol)
  const ultimoIpc = rem?.observado?.length ? rem.observado[rem.observado.length - 1] : null
  // El primer mes del REM que el INDEC todavía no publicó.
  const remProximo = (rem?.mensual ?? []).find((m) => !ultimoIpc || m.mes > ultimoIpc.mes) ?? null
  const vivas = filas.filter((f) => !f.determinado && !f.escasa)
  // El primer mes de IPC que el mercado despeja con datos suficientes.
  const primero = vivas.find((f) => f.implicita != null) ?? null
  const ultimo = vivas[vivas.length - 1] ?? null
  const kpis = [
    { titulo: primero ? `IPC implícito ${etiquetaBloques(primero.nuevos)}` : "IPC implícito", valor: primero?.implicita ?? null, nota: primero ? `${primero.par.fija.symbol}/${primero.par.cer.symbol} · ${diasDe(primero.nuevos)}` : "sin par con datos" },
    { titulo: ultimo ? `Breakeven ${ultimo.par.fija.symbol}/${ultimo.par.cer.symbol}` : "Par más largo", valor: ultimo ? tem(ultimo.be) : null, nota: ultimo ? `TEM · vence ${fechaCorta(ultimo.par.vto)}` : "" },
    { titulo: "Último IPC", valor: ultimoIpc ? ultimoIpc.valor / 100 : null, nota: ultimoIpc ? `INDEC, ${mesLargo(ultimoIpc.mes)}` : "sin dato" },
    { titulo: "REM próximo dato", valor: remProximo ? remProximo.valor / 100 : null, nota: remProximo ? `mediana para ${mesLargo(remProximo.mes)}` : "sin dato" },
  ]

  const datos = vivas.map((f) => ({
    par: `${f.par.fija.symbol}/${f.par.cer.symbol}`,
    beTem: tem(f.be),
    // δ mensualizado: el CER que falta, en TEM. Comparable con el REM de los mismos bloques.
    deltaTem: f.fijados.length + f.nuevos.length ? Math.pow(f.delta, 1 / [...f.fijados, ...f.nuevos].reduce((s, t) => s + t.enTramo / t.dias, 0)) - 1 : null,
    remDelta: f.remDelta,
    implicita: f.implicita,
    remBloques: f.rem,
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
        <div className="text-muted-foreground">Vto. {fechaCorta(f.par.vto)} · CER final {fechaCorta(iso(f.par.cerFinal))}</div>
        <div className="tabular-nums">Nominal {pct(f.par.fija.ytm)} · Real {pct(f.par.cer.ytm)}</div>
        <div className="font-medium tabular-nums">Breakeven {pct(tem(f.be))} mensual · {pct(f.acum, 1)} acumulado</div>
        <div className="tabular-nums text-muted-foreground">CER publicado {pct(f.gamma - 1, 1)} · falta {pct(f.delta - 1, 1)}</div>
        {f.remDelta != null && <div className="tabular-nums">REM mismos meses {pct(f.remDelta)} mensual</div>}
      </div>
    )
  }
  const TipTramo = ({ active, payload }: any) => {
    const f: Fila | undefined = payload?.[0]?.payload?.meta
    if (!active || !f) return null
    return (
      <div style={estiloTooltip} className="px-3 py-2 space-y-0.5">
        <div className="font-medium">IPC de {etiquetaBloques(f.nuevos)}</div>
        <div className="text-muted-foreground">{f.par.fija.symbol} / {f.par.cer.symbol} · {diasDe(f.nuevos)}</div>
        <div className="font-medium tabular-nums">Implícita {pct(f.implicita)} mensual</div>
        {f.rem != null && <div className="tabular-nums">REM {pct(f.rem)} mensual</div>}
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
            Fija y CER al mismo vencimiento. Liquidación {fechaCorta(fechaLiquidacion)}; el CER de cada par es el de 10 hábiles antes del vencimiento.
            {conocido
              ? <> CER publicado hasta el {fechaCorta(iso(conocido.hasta))} ({pct(conocido.gamma - 1)} desde el {fechaCorta(fechaCerAplicable)}, el CER que ya devengó a la liquidación): ese tramo es dato y no entra en la implícita.</>
              : <> Sin serie CER hasta el {fechaCorta(fechaCerAplicable)}: no se puede separar lo publicado de lo implícito.</>}
            {" "}El IPC de un mes rige el CER del 16 del mes siguiente al 15 del otro; cada par despeja los meses que cruza y que ningún par anterior fijó.
            {rem?.fechaRem && <> REM de {mesLargo(rem.fechaRem.slice(0, 7))}.</>}
            {(cerFijados.length > 0 || determinados.length > 0) && <> Afuera por CER ya publicado: {[...cerFijados, ...determinados].join(", ")}.</>}
            {escasos.length > 0 && <> Afuera por despejar menos de {DIAS_MINIMOS} días de CER: {escasos.join(", ")}.</>}
            {sinPar.length > 0 && <> Fijas sin par: {sinPar.join(", ")}.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Par</TableHead>
                <TableHead>Vto.</TableHead>
                <TableHead>CER final</TableHead>
                <TableHead className="text-right">TIR nominal</TableHead>
                <TableHead className="text-right">TIR real</TableHead>
                <TableHead className="text-right">BE TEM</TableHead>
                <TableHead className="text-right">BE acum.</TableHead>
                <TableHead className="text-right">CER falta</TableHead>
                <TableHead>IPC de</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Implícita</TableHead>
                <TableHead className="text-right">REM</TableHead>
                <TableHead className="text-right">Δ (pb)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vivas.map((f) => {
                const delta = f.rem != null && f.implicita != null ? f.implicita - f.rem : null
                const yaFijados = f.fijados.length ? `descuenta ${etiquetaBloques(f.fijados)}, fijado por el par anterior` : ""
                return (
                  <TableRow key={f.par.vto}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {f.par.fija.symbol} <span className="text-muted-foreground font-normal">/ {f.par.cer.symbol}</span>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{fechaCorta(f.par.vto)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{fechaCorta(iso(f.par.cerFinal))}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.par.fija.ytm)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.par.cer.ytm)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(tem(f.be))}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(f.acum, 1)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{pct(f.delta - 1, 1)}</TableCell>
                    <TableCell className="whitespace-nowrap" title={yaFijados}>
                      {etiquetaBloques(f.nuevos)}
                      {f.fijados.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground uppercase">+{f.fijados.length} fijado{f.fijados.length > 1 ? "s" : ""}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap" title={diasDe(f.nuevos)}>
                      {f.diasNuevos}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{pct(f.implicita)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{pct(f.rem)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${delta == null ? "" : delta > 0 ? "text-destructive" : "text-success"}`}>{pb(delta)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            CER falta: (1 + BE acum.) ÷ CER publicado, la variación de CER entre el último dato y el CER final del par
            (Nota Técnica BCRA 8/2024). Implícita: IPC mensual de los meses "IPC de" que hace que ese CER cierre, una vez
            descontados los meses que ya fijó un par anterior. Δ positivo: el mercado descuenta más inflación que el REM
            para esos meses.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">IPC implícito por mes</CardTitle>
            {leyenda([{ color: "var(--chart-1)", nombre: "IPC mensual que despeja cada par" }, ...(senda ? [{ color: "#c2410c", nombre: "REM mismos meses", punteada: true }] : [])])}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={datos} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                {ejeX}{ejeY}
                <Tooltip content={<TipTramo />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                {lineaIpc}
                <Bar dataKey="implicita" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                {senda && <Line type="monotone" dataKey="remBloques" stroke="#c2410c" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">CER que falta, mensualizado</CardTitle>
            {leyenda([{ color: "var(--chart-4)", nombre: "Último CER publicado → CER final del par, TEM" }, ...(senda ? [{ color: "#c2410c", nombre: "REM mismos meses", punteada: true }] : [])])}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={datos} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                {ejeX}{ejeY}
                <Tooltip content={<TipBe />} />
                {lineaIpc}
                {senda && <Line type="monotone" dataKey="remDelta" stroke="#c2410c" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />}
                <Line type="monotone" dataKey="deltaTem" stroke="var(--chart-4)" strokeWidth={2} isAnimationActive={false}
                  dot={{ r: 4, fill: "var(--chart-4)", stroke: "var(--background)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
