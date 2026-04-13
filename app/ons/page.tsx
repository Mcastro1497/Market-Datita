"use client"

import { useState, useEffect } from "react"
import { ONSFilters } from "@/components/ons-filters"
import { ONSDetailsFilters } from "@/components/ons-details-filters"
import { ONSTable } from "@/components/ons-table"
import { ONSMetrics } from "@/components/ons-metrics"
import { ONDetailsTable } from "@/components/ons-details-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { ONWithDetails } from "@/lib/types"
import { Loader2, Settings, ArrowLeft, Home, RefreshCw } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"

const fetcher = async () => {
  const supabase = createClient()

  // Fetch flows paginado desde instrument_flows
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

  const [allFlowsRaw, instrumentsResult, pricesResult] = await Promise.all([
    fetchAllFlows(),
    supabase.from("instruments").select("*").eq("instrument_type", "ON").eq("is_active", true),
    supabase.from("prices").select("*"),
  ])

  if (instrumentsResult.error) throw instrumentsResult.error
  if (pricesResult.error) throw pricesResult.error

  const instrumentsData = instrumentsResult.data || []
  const pricesData = pricesResult.data || []

  // Solo flujos de ONs
  const onSymbols = new Set(instrumentsData.map((i: any) => i.symbol))
  const flowsData = allFlowsRaw.filter((f: any) => onSymbols.has(f.symbol))

  // Mapas
  const instrumentsMap = new Map(instrumentsData.map((i: any) => [i.symbol, i]))
  const pricesMap = new Map(pricesData.map((p: any) => [p.symbol, p]))

  // Adaptar flows al formato ONWithDetails esperado por los componentes
  const adaptFlow = (flow: any): any => {
    const instr = instrumentsMap.get(flow.symbol) as any
    const price = pricesMap.get(flow.symbol) as any
    return {
      ...flow,
      ticker: flow.symbol,
      emisor: instr?.emisor || "",
      details: instr ? {
        ticker:            instr.symbol,
        fecha_vencimiento: instr.fecha_vencimiento,
        legislacion:       instr.legislacion,
        jurisdiccion_pago: instr.jurisdiccion_pago,
        lamina_minima:     instr.lamina_minima,
        calleable:         instr.calleable,
        monto_residual:    instr.monto_residual,
      } : null,
      lastPrice: price ? {
        ...price,
        change:    price.change_pct,   // alias para compatibilidad
        price_usd: price.last,         // alias para compatibilidad
      } : null,
    }
  }

  // Un registro por ticker (último flujo)
  const byTicker = new Map<string, any>()
  flowsData.forEach((flow: any) => {
    const existing = byTicker.get(flow.symbol)
    if (!existing || new Date(flow.fecha_pago) > new Date(existing.fecha_pago)) {
      byTicker.set(flow.symbol, flow)
    }
  })

  const flowsWithDetails: ONWithDetails[] = Array.from(byTicker.values()).map(adaptFlow)
  const allFlowsAdapted = flowsData.map(adaptFlow)

  const uniqueEmisores = [...new Set(instrumentsData.map((i: any) => i.emisor).filter(Boolean))].sort() as string[]
  const uniqueLegislaciones = [...new Set(instrumentsData.map((i: any) => i.legislacion).filter(Boolean))].sort() as string[]
  const uniqueJurisdicciones = [...new Set(instrumentsData.map((i: any) => i.jurisdiccion_pago).filter(Boolean))].sort() as string[]

  return {
    flowsData: allFlowsAdapted,
    flowsWithDetails,
    emisores: uniqueEmisores,
    legislaciones: uniqueLegislaciones,
    jurisdicciones: uniqueJurisdicciones,
  }
}

export default function ONSDashboard() {
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [filteredDetailsData, setFilteredDetailsData] = useState<ONWithDetails[]>([])

  const { data, error, isLoading, mutate } = useSWR("ons-data", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  useEffect(() => {
    if (data?.flowsData) setFilteredData(data.flowsData)
    if (data?.flowsWithDetails) setFilteredDetailsData(data.flowsWithDetails)
  }, [data])

  const handleFiltersChange = (filters: {
    emisores?: string[]
    ticker?: string
    fechaDesde?: Date
    fechaHasta?: Date
  }) => {
    if (!data?.flowsData) return
    let filtered = [...data.flowsData]
    if (filters.emisores?.length) filtered = filtered.filter((f) => filters.emisores!.includes(f.emisor))
    if (filters.ticker) filtered = filtered.filter((f) => f.ticker.toLowerCase().includes(filters.ticker!.toLowerCase()))
    if (filters.fechaDesde) filtered = filtered.filter((f) => new Date(f.fecha_pago) >= filters.fechaDesde!)
    if (filters.fechaHasta) filtered = filtered.filter((f) => new Date(f.fecha_pago) <= filters.fechaHasta!)
    setFilteredData(filtered)
  }

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
      <div className="flex items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Cargando dashboard...</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 mb-4">Error al cargar los datos</p>
        <Button onClick={() => mutate()}>Reintentar</Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/"><Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent"><Home className="h-4 w-4" />Inicio</Button></Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard de ONs</h1>
                <p className="text-slate-600">Análisis y seguimiento de flujos de Obligaciones Negociables</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/soberanos"><Button variant="outline" className="flex items-center gap-2 bg-transparent border-green-200 text-green-700 hover:bg-green-50"><ArrowLeft className="h-4 w-4" />Soberanos HD</Button></Link>
              <Link href="/admin"><Button variant="outline" className="flex items-center gap-2 bg-transparent"><Settings className="h-4 w-4" />Administración</Button></Link>
              <Button onClick={() => mutate()} variant="outline" size="sm" className="flex items-center gap-2 bg-transparent" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Actualizar
              </Button>
            </div>
          </div>
        </div>

        {data && <ONSMetrics data={filteredData} />}

        <Tabs defaultValue="detalles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detalles">Detalles de ONs</TabsTrigger>
            <TabsTrigger value="flujos">Flujos de Pagos</TabsTrigger>
          </TabsList>
          <TabsContent value="detalles" className="space-y-6">
            {data && <ONSDetailsFilters legislaciones={data.legislaciones} jurisdicciones={data.jurisdicciones} emisores={data.emisores} onFiltersChange={handleDetailsFiltersChange} />}
            <ONDetailsTable flows={filteredDetailsData} />
          </TabsContent>
          <TabsContent value="flujos" className="space-y-6">
            {data && <ONSFilters emisores={data.emisores} onFiltersChange={handleFiltersChange} />}
            <ONSTable data={filteredData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
