"use client"

/**
 * Recorrido intradiario del dólar mayorista de MAE: precio, VWAP y volumen.
 *
 * DE DÓNDE SALE
 * De `/api/fx-rueda`, que proxea el endpoint `datosgrafico` de MAE. Devuelve la
 * rueda entera —una entrada por OPERACIÓN, con su volumen— y acepta cualquier
 * fecha pasada, así que no hace falta guardar nada.
 *
 * EL VWAP ES ACUMULADO, NO UNA MEDIA MÓVIL
 * VWAP(t) = Σ(precio·volumen) / Σ(volumen) desde la apertura hasta t. Por eso
 * arranca pegado al primer precio y se va aquietando: cada operación nueva pesa
 * cada vez menos contra todo lo anterior. Es el precio promedio al que
 * efectivamente se operó el día, que es contra lo que se mide una ejecución.
 *
 * QUÉ ES UNA OPERACIÓN "ALTA"
 * Las de volumen mayor o igual al percentil 75 de la rueda. Umbral relativo y no
 * un monto fijo: una rueda tranquila y una movida no se miden con la misma vara,
 * y lo que interesa es dónde se operó fuerte PARA ESE DÍA. Sólo esas llevan
 * burbuja; dibujar las 144 tapa la línea.
 *
 * El ÁREA del círculo es proporcional al monto, no el radio: con el radio, una
 * operación del doble se vería cuatro veces más grande.
 *
 * LA HORA VIENE CORRIDA
 * MAE manda `time` como hora de Buenos Aires codificada como si fuera UTC, así
 * que se formatea en UTC. Leerlo como UTC-3 corre la rueda tres horas para
 * atrás, a mercado cerrado.
 */

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts"

type Punto = { time: number; value: number }

const hhmm = (epoch: number) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(epoch * 1000))

const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const enM = (v: number) => `${nf2.format(v / 1e6)} M`

const COLOR_PRECIO = "var(--chart-1)"
const COLOR_VWAP = "var(--success)"
const COLOR_VOL = "#c2410c"
// Los dos tonos del volumen van SÓLIDOS, sin opacidad. Con el outlier de 45 M
// fijando la escala, la barra de la mediana mide cuatro píxeles, y a ese tamaño
// cualquier transparencia sobre fondo blanco desaparece: da igual el tono, lo
// que mata es el alfa. La referencia se ve porque es fondo negro con amarillo.
const COLOR_ALTO = "#9a3412"   // naranja oscuro: domina
const COLOR_BAJO = "#ea580c"   // naranja medio: se lee igual a cuatro píxeles

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

  const d = useMemo(() => {
    // MAE manda las dos series alineadas, una entrada por operación. Si algún día
    // no coinciden se cae al cruce por timestamp, que es más lento pero no miente.
    const porTiempo = new Map(volumenes.map((v) => [v.time, v.value]))
    const alineadas = precios.length === volumenes.length
    const ops = precios.map((p, i) => ({
      t: p.time,
      tc: p.value,
      vol: alineadas ? volumenes[i].value : (porTiempo.get(p.time) ?? 0),
    }))
    if (!ops.length) return null

    // VWAP acumulado desde la apertura.
    let sumaPV = 0, sumaV = 0
    const serie = ops.map((o) => {
      sumaPV += o.tc * o.vol
      sumaV += o.vol
      return { ...o, vwap: sumaV > 0 ? sumaPV / sumaV : o.tc }
    })

    const vols = ops.map((o) => o.vol).filter((v) => v > 0).sort((a, b) => a - b)
    const p75 = vols.length ? vols[Math.floor(vols.length * 0.75)] : 0
    const promedio = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0
    const altos = serie.filter((o) => o.vol >= p75 && o.vol > 0)

    return {
      serie, altos, umbral: p75, promedio,
      volMax: vols.length ? vols[vols.length - 1] : 0,
      total: vols.reduce((a, b) => a + b, 0),
      precio: serie[serie.length - 1].tc,
      vwap: serie[serie.length - 1].vwap,
      t0: serie[0].t, t1: serie[serie.length - 1].t,
    }
  }, [precios, volumenes])

  if (cargando) return null
  if (error || !d || d.serie.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Rueda del mayorista</CardTitle>
          <CardDescription>{error ?? "Todavía no hay operaciones de hoy en MAE."}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const paso = 30 * 60
  const marcas: number[] = []
  for (let t = Math.ceil(d.t0 / paso) * paso; t <= d.t1; t += paso) marcas.push(t)
  const ejeX = {
    type: "number" as const, dataKey: "t", domain: [d.t0, d.t1] as [number, number],
    ticks: marcas, tickFormatter: hhmm,
    tick: { fontSize: 11, fill: "var(--muted-foreground)" },
    stroke: "var(--border)", allowDuplicatedCategory: false,
  }

  const Tip = ({ active, payload }: any) => {
    const p = payload?.[0]?.payload
    if (!active || !p) return null
    return (
      <div className="rounded-md border px-3 py-2 text-xs"
           style={{ background: "var(--popover)", borderColor: "var(--border)" }}>
        <div className="font-medium tabular-nums">{hhmm(p.t)}</div>
        {p.tc != null && <div className="tabular-nums">TC {nf2.format(p.tc)}</div>}
        {p.vwap != null && (
          <div className="tabular-nums" style={{ color: COLOR_VWAP }}>VWAP {nf2.format(p.vwap)}</div>
        )}
        {p.vol > 0 && (
          <div className="tabular-nums text-muted-foreground">
            Operado {enM(p.vol)}{p.vol >= d.umbral ? " · alto" : ""}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-lg">Rueda del mayorista</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Precio <span className="font-medium tabular-nums text-foreground">{nf2.format(d.precio)}</span></span>
            <span>VWAP <span className="font-medium tabular-nums" style={{ color: COLOR_VWAP }}>{nf2.format(d.vwap)}</span></span>
            <span>Operado <span className="font-medium tabular-nums text-foreground">{enM(d.total)}</span></span>
            <span className="tabular-nums">{d.serie.length} ops · {d.altos.length} altas</span>
          </div>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: COLOR_PRECIO }} />Precio
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: COLOR_VWAP }} />VWAP acumulado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR_VOL, opacity: 0.55 }} />
            Operación alta
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis {...ejeX} />
            <YAxis type="number" dataKey="tc" domain={["dataMin - 0.5", "dataMax + 0.5"]} width={62}
              tickFormatter={(v: number) => nf2.format(v)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
            <ZAxis type="number" dataKey="vol" range={[40, 850]} domain={[d.umbral, d.volMax || 1]} />
            <Tooltip content={<Tip />} />
            <Line data={d.serie} type="linear" dataKey="tc" stroke={COLOR_PRECIO} strokeWidth={1.75}
              dot={false} isAnimationActive={false} />
            <Line data={d.serie} type="monotone" dataKey="vwap" stroke={COLOR_VWAP} strokeWidth={2}
              dot={false} isAnimationActive={false} />
            <Scatter data={d.altos} dataKey="tc" fill={COLOR_VOL} fillOpacity={0.3}
              stroke={COLOR_VOL} strokeOpacity={0.8} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>

      </CardContent>
    </Card>

    {/* Tarjeta aparte y no un panel al pie: apretado contra el precio nunca
        tiene alto suficiente, y las barras de la mediana quedan en dos píxeles.
        Comparten dominio y marcas del eje, así que se leen alineados igual. */}
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-lg">Volumen por operación</CardTitle>
          <div className="text-xs tabular-nums text-muted-foreground">
            mayor {enM(d.volMax)} · promedio {enM(d.promedio)}
          </div>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: COLOR_ALTO }} />
            vol alto (≥ p75 = {enM(d.umbral)})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: COLOR_BAJO }} />
            vol bajo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4" style={{ background: COLOR_ALTO }} />umbral
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 bg-muted-foreground" />prom {enM(d.promedio)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={d.serie} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis {...ejeX} />
            <YAxis width={62} tickFormatter={(v: number) => `${nf2.format(v / 1e6)}M`}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)"
              tickCount={6} />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
            <ReferenceLine y={d.umbral} stroke={COLOR_ALTO} strokeDasharray="4 3"
              label={{ value: "p75", position: "insideTopRight", fontSize: 9, fill: COLOR_ALTO }} />
            <ReferenceLine y={d.promedio} stroke="var(--muted-foreground)" strokeDasharray="2 3"
              strokeOpacity={0.7}
              label={{ value: `prom ${enM(d.promedio)}`, position: "insideBottomRight",
                       fontSize: 9, fill: "var(--muted-foreground)" }} />
            <Bar dataKey="vol" isAnimationActive={false} barSize={5} minPointSize={2}>
              {d.serie.map((o, i) => (
                <Cell key={i}
                  fill={o.vol >= d.umbral ? COLOR_ALTO : COLOR_BAJO} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
    </div>
  )
}
