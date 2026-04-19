"use client"

import { useState, useEffect } from "react"
import { DlkDetailsFilters } from "@/components/dlk-details-filters"
import { DlkDetailsTable } from "@/components/dlk-details-table"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { DlkWithDetails } from "@/lib/types"
import { Loader2, Home, TrendingUp, RefreshCw, PiggyBank, DollarSign, Link2 } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"

const FX_SYMBOL = "UST" // tipo de cambio oficial guardado en `prices`

const fetcher = async () => {
  const supabase = createClient()

  const fetchAllFlows = async () => {
    let allFlows: any[] = []
    let start = 0
    const batchSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from("instrument_flows")
        .select("*")
        .order("fecha_pago", { ascending: true })
        .range(start, start + batchSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allFlows = [...allFlows, ...data]
      if (data.length < batchSize) break
      start += batchSize
    }
    return allFlows
  }

  const [allFlowsRaw, instrumentsResult, pricesResult, fxResult] = await Promise.all([
    fetchAllFlows(),
    supabase.from("instruments").select("*").eq("instrument_type", "DLK").eq("is_active", true),
    supabase.from("prices").select("*"),
    supabase.from("prices").select("last, ts").eq("symbol", FX_SYMBOL).maybeSingle(),
  ])

  if (instrumentsResult.error) throw instrumentsResult.error
  if (pricesResult.error) throw pricesResult.error
  if (fxResult.error) throw fxResult.error

  const instrumentsData = instrumentsResult.data || []
  const pricesData = pricesResult.data || []
  const fxOficial = fxResult.data?.last ? Number(fxResult.data.last) : null
  const fxTs = fxResult.data?.ts ?? null

  const dlkSymbols = new Set(instrumentsData.map((i: any) => i.symbol))
  const flowsData = allFlowsRaw.filter((f: any) => dlkSymbols.has(f.symbol))

  const instrumentsMap = new Map(instrumentsData.map((i: any) => [i.symbol, i]))
  const pricesMap = new Map(pricesData.map((p: any) => [p.symbol, p]))

  // Tomar el último flujo por símbolo (mismo patrón que soberanos/soberanos-ars)
  const byTicker = new Map<string, any>()
  flowsData.forEach((flow: any) => {
    const existing = byTicker.get(flow.symbol)
    if (!existing || new Date(flow.fecha_pago) > new Date(existing.fecha_pago)) {
      byTicker.set(flow.symbol, flow)
    }
  })

  const flowsWithDetails: DlkWithDetails[] = Array.from(byTicker.values()).map((flow: any) => {
    const instr = instrumentsMap.get(flow.symbol) as any
    const price = pricesMap.get(flow.symbol) as any
    const priceArs = price?.last != null ? Number(price.last) : null
    const priceUsd = priceArs != null && fxOficial && fxOficial > 0 ? priceArs / fxOficial : null
    return {
      ...flow,
      ticker: flow.symbol,
      emisor: instr?.emisor || "Tesoro Argentino",
      details: instr ? {
        ticker:            instr.symbol,
        fecha_vencimiento: instr.fecha_vencimiento,
        legislacion:       instr.legislacion,
        jurisdiccion_pago: instr.jurisdiccion_pago,
        lamina_minima:     instr.lamina_minima,
        calleable:         instr.calleable,
        monto_residual:    instr.monto_residual,
        moneda:            instr.moneda,
        tipo:              instr.tipo,
        cer_emision:       instr.cer_emision,
      } : null,
      lastPrice: price ? {
        ...price,
        change:    price.change_pct,
        price_ars: priceArs,
        price_usd: priceUsd,
      } : null,
    }
  })

  const uniqueEmisores = [...new Set(instrumentsData.map((i: any) => i.emisor).filter(Boolean))].sort() as string[]
  const uniqueLegislaciones = [...new Set(instrumentsData.map((i: any) => i.legislacion).filter(Boolean))].sort() as string[]
  const uniqueJurisdicciones = [...new Set(instrumentsData.map((i: any) => i.jurisdiccion_pago).filter(Boolean))].sort() as string[]

  return {
    flowsWithDetails,
    emisores: uniqueEmisores,
    legislaciones: uniqueLegislaciones,
    jurisdicciones: uniqueJurisdicciones,
    fxOficial,
    fxTs,
  }
}

export default function DlkDashboard() {
  const [filteredDetailsData, setFilteredDetailsData] = useState<DlkWithDetails[]>([])

  const { data, error, isLoading, mutate } = useSWR("dlk-data", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  useEffect(() => {
    if (data?.flowsWithDetails) setFilteredDetailsData(data.flowsWithDetails)
  }, [data])

  const handleDetailsFiltersChange = (filters: {
    legislacion?: string
    jurisdiccionPago?: string
    emisores?: string[]
    fechaVencimientoHasta?: Date
  }) => {
    if (!data?.flowsWithDetails) return
    let filtered = [...data.flowsWithDetails]
    if (filters.legislacion) filtered = filtered.filter((f) => f.details?.legislacion === filters.legislacion)
    if (filters.jurisdiccionPago) filtered = filtered.filter((f) => f.details?.jurisdiccion_pago === filters.jurisdiccionPago)
    if (filters.emisores?.length) filtered = filtered.filter((f) => filters.emisores!.includes(f.emisor))
    if (filters.fechaVencimientoHasta) {
      filtered = filtered.filter((f) => {
        if (!f.details?.fecha_vencimiento) return false
        return new Date(f.details.fecha_vencimiento) <= filters.fechaVencimientoHasta!
      })
    }
    setFilteredDetailsData(filtered)
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2"><Loader2 className="h-6 w-6 animate-spin" /><span>Cargando dashboard de Dólar Linked...</span></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><p className="text-red-600 mb-4">Error al cargar los datos</p><Button onClick={() => mutate()}>Reintentar</Button></div>
    </div>
  )

  const formatFx = (v: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(v)

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/"><Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent"><Home className="h-4 w-4" />Inicio</Button></Link>
              <Link href="/ons"><Button variant="outline" className="flex items-center gap-2 bg-transparent border-blue-200 text-blue-700 hover:bg-blue-50"><TrendingUp className="h-4 w-4" />Dashboard ONs</Button></Link>
              <Link href="/soberanos"><Button variant="outline" className="flex items-center gap-2 bg-transparent border-green-200 text-green-700 hover:bg-green-50"><DollarSign className="h-4 w-4" />Soberanos HD</Button></Link>
              <Link href="/soberanos-ars"><Button variant="outline" className="flex items-center gap-2 bg-transparent border-orange-200 text-orange-700 hover:bg-orange-50"><PiggyBank className="h-4 w-4" />Soberanos ARS</Button></Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard de Dólar Linked</h1>
                <p className="text-slate-600">Bonos en pesos ajustados por tipo de cambio oficial (A3500)</p>
              </div>
            </div>
            <Button onClick={() => mutate()} variant="outline" size="sm" className="flex items-center gap-2 bg-transparent" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Actualizar
            </Button>
          </div>

          {/* Banner del FX oficial */}
          <div className="mt-4 flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-md px-4 py-2 text-sm">
            <Link2 className="h-4 w-4 text-purple-600" />
            <span className="text-purple-800 font-medium">Dólar oficial (MAE A3500):</span>
            <span className="font-mono text-purple-900">${formatFx(data?.fxOficial ?? null)}</span>
            {data?.fxTs && (
              <span className="text-purple-600 text-xs ml-auto">
                Última actualización: {new Date(data.fxTs).toLocaleString("es-AR")}
              </span>
            )}
          </div>
        </div>

        {data && <DlkDetailsFilters legislaciones={data.legislaciones} jurisdicciones={data.jurisdicciones} emisores={data.emisores} onFiltersChange={handleDetailsFiltersChange} />}
        <DlkDetailsTable flows={filteredDetailsData} fxOficial={data?.fxOficial ?? null} />
      </div>
    </div>
  )
}
