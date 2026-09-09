"use client"

/**
 * Recorrido intradiario del dólar mayorista de MAE, con el volumen encima.
 *
 * DE DÓNDE SALE
 * De `/api/fx-rueda`, que proxea el endpoint `datosgrafico` de MAE. Ese endpoint
 * devuelve la rueda entera —una entrada por OPERACIÓN, con su volumen— y acepta
 * cualquier fecha pasada, así que no hace falta guardar nada: el histórico se
 * pide cuando se necesita.
 *
 * EL VOLUMEN ES POR OPERACIÓN
 * No es un acumulado del día, así que no hay que restar nada contra la lectura
 * anterior: cada burbuja es una operación y su tamaño, lo que se operó ahí.
 *
 * El ÁREA del círculo es proporcional al monto, no el radio. Con el radio, una
 * operación del doble se vería cuatro veces más grande, que es justo lo que uno
 * cree estar comparando cuando mira burbujas.
 *
 * LA HORA VIENE CORRIDA
 * MAE manda `time` como la hora de Buenos Aires codificada como si fuera UTC.
 * Por eso se formatea en UTC: así sale la hora local correcta. Leerlo como
 * UTC-3 mueve toda la rueda tres horas para atrás, a horario de mercado cerrado.
 */

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer,
  Scatter, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts"

type Punto = { time: number; value: number }

const hhmm = (epoch: number) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(epoch * 1000))

const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 })
const enM = (v: number) => `${nf0.format(v / 1e6)} M`

export function FxRuedaChart() {
  const [precios, setPrecios] = useState<Punto[]>([])
  const [volumenes, setVolumenes] = useState<Punto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancel = false
    const load = async () => {
      try {
        const r = await fetch("/api/fx-rueda")
        const d = await r.json()
        if (cancel) return
        if (!r.ok) { setError(d?.error ?? "no se pudo consultar MAE"); return }
        setError(null)
        setPrecios(d.precios ?? [])
        setVolumenes(d.volumenes ?? [])
      } catch {
        if (!cancel) setError("no se pudo consultar MAE")
      } finally {
        if (!cancel) setCargando(false)
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => { cancel = true; clearInterval(id) }
  }, [])

  const { linea, burbujas, resumen, volMax } = useMemo(() => {
    const linea = precios.map((p) => ({ t: p.time, tc: p.value }))
    const porTiempo = new Map(precios.map((p) => [p.time, p.value]))
    const burbujas = volumenes
      .filter((v) => v.value > 0 && porTiempo.has(v.time))
      .map((v) => ({ t: v.time, tc: porTiempo.get(v.time)!, vol: v.value }))
    const vals = precios.map((p) => p.value)
    return {
      linea, burbujas,
      volMax: burbujas.reduce((m, b) => Math.max(m, b.vol), 0),
      resumen: vals.length ? {
        apertura: vals[0], ultimo: vals[vals.length - 1],
        minimo: Math.min(...vals), maximo: Math.max(...vals),
        total: volumenes.reduce((s, v) => s + v.value, 0),
        operaciones: volumenes.length,
      } : null,
    }
  }, [precios, volumenes])

  if (cargando) return null
  if (error || linea.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Rueda del mayorista</CardTitle>
          <CardDescription>
            {error ?? "Todavía no hay operaciones de hoy en MAE."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const t0 = linea[0].t, t1 = linea[linea.length - 1].t
  const paso = 30 * 60           // marcas cada media hora, en hora redonda
  const marcas: number[] = []
  for (let t = Math.ceil(t0 / paso) * paso; t <= t1; t += paso) marcas.push(t)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-lg">Rueda del mayorista</CardTitle>
          {resumen && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Apertura <span className="font-medium tabular-nums text-foreground">{nf2.format(resumen.apertura)}</span></span>
              <span>Mín <span className="font-medium tabular-nums text-foreground">{nf2.format(resumen.minimo)}</span></span>
              <span>Máx <span className="font-medium tabular-nums text-foreground">{nf2.format(resumen.maximo)}</span></span>
              <span>Último <span className="font-medium tabular-nums text-foreground">{nf2.format(resumen.ultimo)}</span></span>
              <span>Operado <span className="font-medium tabular-nums text-foreground">{enM(resumen.total)}</span></span>
            </div>
          )}
        </div>
        <CardDescription>
          Cada círculo es una operación; el área es proporcional al monto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              type="number" dataKey="t" domain={[t0, t1]} ticks={marcas}
              tickFormatter={hhmm}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)" allowDuplicatedCategory={false}
            />
            <YAxis
              type="number" dataKey="tc" domain={["dataMin - 0.5", "dataMax + 0.5"]} width={62}
              tickFormatter={(v: number) => nf2.format(v)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            {/* El volumen sólo define el tamaño del círculo, no un eje visible. */}
            <ZAxis type="number" dataKey="vol" range={[30, 900]} domain={[0, volMax || 1]} />
            {resumen && (
              <ReferenceLine y={resumen.apertura} stroke="var(--muted-foreground)"
                strokeDasharray="4 4" strokeOpacity={0.7}
                label={{ value: "apertura", position: "insideTopLeft", fontSize: 10,
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
                    <div className="tabular-nums">TC {nf2.format(p.tc)}</div>
                    {p.vol != null && (
                      <div className="tabular-nums text-muted-foreground">Operado {enM(p.vol)}</div>
                    )}
                  </div>
                )
              }}
            />
            <Line data={linea} type="linear" dataKey="tc" stroke="var(--chart-1)" strokeWidth={2}
              dot={false} isAnimationActive={false} />
            <Scatter data={burbujas} dataKey="tc" fill="#c2410c" fillOpacity={0.3}
              stroke="#c2410c" strokeOpacity={0.75} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        {resumen && (
          <p className="pt-1 text-xs tabular-nums text-muted-foreground">
            {resumen.operaciones} operaciones · mayor {enM(volMax)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
