"use client"

/**
 * Recorrido intradiario del dólar mayorista de MAE, con el volumen encima.
 *
 * DE DÓNDE SALE
 * De `fx_mae_rueda`, una fila por lectura del relay (cada 60 segundos). En
 * `prices` el mayorista se guarda con upsert, así que ahí sólo vive el último
 * valor: el recorrido se pisa a sí mismo y no se puede reconstruir después.
 *
 * EL VOLUMEN ES UNA DIFERENCIA
 * MAE publica `montoNegociadoHoy` ACUMULADO, no por operación. Lo operado en
 * cada intervalo es la resta contra la lectura anterior, y eso es lo que dibuja
 * cada burbuja. Los intervalos sin movimiento no llevan burbuja: la mayoría de
 * las lecturas repiten el acumulado porque MAE lo actualiza a los saltos, y
 * pintar un círculo de área cero en cada minuto sería ruido.
 *
 * El área del círculo —no el radio— es proporcional al monto, que es como se
 * compara bien un tamaño a ojo. Con el radio, un golpe del doble se vería
 * cuatro veces más grande.
 */

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer,
  Scatter, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts"

type Fila = {
  ts: string
  last: number
  apertura: number | null
  maximo: number | null
  minimo: number | null
  cierre_anterior: number | null
  monto_operado: number | null
}

const TZ = "America/Argentina/Buenos_Aires"
const hhmm = (ms: number) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date(ms))
const nfTC = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const enMM = (v: number) => `${nfTC.format(v / 1e9)} mil M`

export function FxRuedaChart() {
  const supabase = useMemo(() => createClient(), [])
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancel = false
    const load = async () => {
      // Desde la medianoche argentina: la rueda del mayorista es 10:00-15:00,
      // así que un corte por día alcanza y evita traer el histórico entero.
      const hoy = new Date()
      const dia = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(hoy)
      const { data, error } = await supabase
        .from("fx_mae_rueda")
        .select("ts, last, apertura, maximo, minimo, cierre_anterior, monto_operado")
        .gte("ts", `${dia}T00:00:00-03:00`)
        .order("ts")
      if (!cancel && !error && data) setFilas(data as Fila[])
      if (!cancel) setCargando(false)
    }
    load()
    const id = setInterval(load, 60000)   // misma cadencia que el relay
    return () => { cancel = true; clearInterval(id) }
  }, [supabase])

  const { puntos, burbujas, resumen } = useMemo(() => {
    const puntos = filas.map((f) => ({ t: new Date(f.ts).getTime(), tc: f.last }))
    const burbujas: { t: number; tc: number; vol: number }[] = []
    for (let i = 1; i < filas.length; i++) {
      const a = filas[i - 1].monto_operado, b = filas[i].monto_operado
      if (a == null || b == null) continue
      const vol = b - a
      if (vol > 0) burbujas.push({ t: new Date(filas[i].ts).getTime(), tc: filas[i].last, vol })
    }
    const u = filas[filas.length - 1]
    return {
      puntos, burbujas,
      resumen: u ? {
        apertura: u.apertura, minimo: u.minimo, maximo: u.maximo,
        ultimo: u.last, monto: u.monto_operado, cierreAnt: u.cierre_anterior,
      } : null,
    }
  }, [filas])

  if (cargando) return null
  if (puntos.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Rueda del mayorista</CardTitle>
          <CardDescription>
            Todavía no hay lecturas de hoy. El relay escribe una por minuto entre las 10 y las 15.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const t0 = puntos[0].t, t1 = puntos[puntos.length - 1].t
  const volMax = burbujas.reduce((m, b) => Math.max(m, b.vol), 0)
  // Marcas cada media hora, en hora redonda.
  const marcas: number[] = []
  const paso = 30 * 60000
  for (let t = Math.ceil(t0 / paso) * paso; t <= t1; t += paso) marcas.push(t)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-lg">Rueda del mayorista</CardTitle>
          {resumen && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Apertura <span className="font-medium tabular-nums text-foreground">{resumen.apertura != null ? nfTC.format(resumen.apertura) : "—"}</span></span>
              <span>Mín <span className="font-medium tabular-nums text-foreground">{resumen.minimo != null ? nfTC.format(resumen.minimo) : "—"}</span></span>
              <span>Máx <span className="font-medium tabular-nums text-foreground">{resumen.maximo != null ? nfTC.format(resumen.maximo) : "—"}</span></span>
              <span>Último <span className="font-medium tabular-nums text-foreground">{nfTC.format(resumen.ultimo)}</span></span>
              <span>Operado <span className="font-medium tabular-nums text-foreground">{resumen.monto != null ? enMM(resumen.monto) : "—"}</span></span>
            </div>
          )}
        </div>
        <CardDescription>
          Cada círculo es lo operado desde la lectura anterior; el área es proporcional al monto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              type="number" dataKey="t" domain={[t0, t1]} ticks={marcas}
              tickFormatter={(v: number) => hhmm(v)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)" allowDuplicatedCategory={false}
            />
            <YAxis
              type="number" dataKey="tc" domain={["dataMin - 0.5", "dataMax + 0.5"]} width={62}
              tickFormatter={(v: number) => nfTC.format(v)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            {/* El volumen sólo define el tamaño del círculo, no un eje visible. */}
            <ZAxis type="number" dataKey="vol" range={[40, 900]} domain={[0, volMax || 1]} />
            {resumen?.cierreAnt != null && (
              <ReferenceLine y={resumen.cierreAnt} stroke="var(--muted-foreground)"
                strokeDasharray="4 4" strokeOpacity={0.7}
                label={{ value: "cierre ant.", position: "insideTopLeft", fontSize: 10,
                         fill: "var(--muted-foreground)" }} />
            )}
            <Tooltip
              content={({ active, payload }: any) => {
                const p = payload?.[0]?.payload
                if (!active || !p) return null
                return (
                  <div className="rounded-md border px-3 py-2 text-xs"
                       style={{ background: "var(--popover)", borderColor: "var(--border)" }}>
                    <div className="font-medium tabular-nums">{hhmm(p.t)}</div>
                    <div className="tabular-nums">TC {nfTC.format(p.tc)}</div>
                    {p.vol != null && (
                      <div className="tabular-nums text-muted-foreground">Operado {enMM(p.vol)}</div>
                    )}
                  </div>
                )
              }}
            />
            <Line data={puntos} type="linear" dataKey="tc" stroke="var(--chart-1)" strokeWidth={2}
              dot={false} isAnimationActive={false} />
            <Scatter data={burbujas} dataKey="tc" fill="#c2410c" fillOpacity={0.35}
              stroke="#c2410c" strokeOpacity={0.8} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="pt-1 text-xs text-muted-foreground tabular-nums">
          {puntos.length} lecturas · {burbujas.length} intervalos con operaciones
          {volMax > 0 && <> · mayor golpe {enMM(volMax)}</>}
        </p>
      </CardContent>
    </Card>
  )
}
