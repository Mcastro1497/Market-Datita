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
import type { ONFlow, ONWithDetails } from "@/lib/types"
import { Loader2, Settings, ArrowLeft, Home, RefreshCw } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"

const fetcher = async () => {
  const supabase = createClient()

  const fetchAllFlows = async () => {
    let allFlows: any[] = []
    let start = 0
    const batchSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from("ons_flows")
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

  const [flowsData, detailsResult, pricesResult] = await Promise.all([
    fetchAllFlows(),
    supabase.from("ons_details").select("*"),
    supabase.from("last_prices").select("*"),
  ])

  if (detailsResult.error) throw detailsResult.error
  if (pricesResult.error) throw pricesResult.error

  const detailsData = detailsResult.data || []
  const pricesData = pricesResult.data || []

  const detailsMap = new Map(detailsData.map((detail) => [detail.ticker, detail]))
  const pricesMap = new Map(pricesData.map((price) => [price.symbol, price]))

  const flowsByTicker = new Map<string, ONFlow>()
  flowsData.forEach((flow) => {
    const existingFlow = flowsByTicker.get(flow.ticker)
    if (!existingFlow || new Date(flow.fecha_pago) > new Date(existingFlow.fecha_pago)) {
      flowsByTicker.set(flow.ticker, flow)
    }
  })

  const uniqueFlows = Array.from(flowsByTicker.values())
  const flowsWithDetails: ONWithDetails[] = uniqueFlows.map((flow) => ({
    ...flow,
    details: detailsMap.get(flow.ticker) || null,
    lastPrice: pricesMap.get(flow.ticker) || null,
  }))

  const uniqueEmisores = [...new Set(flowsData.map((flow) => flow.emisor))].sort()
  const uniqueLegislaciones = [...new Set(detailsData.map((detail) => detail.legislacion).filter(Boolean))].sort()
  const uniqueJurisdicciones = [
    ...new Set(detailsData.map((detail) => detail.jurisdiccion_pago).filter(Boolean)),
  ].sort()

  return {
    flowsData,
    flowsWithDetails,
    emisores: uniqueEmisores,
    legislaciones: uniqueLegislaciones,
    jurisdicciones: uniqueJurisdicciones,
  }
}

export default function ONSDashboard() {
  const [filteredData, setFilteredData] = useState<ONFlow[]>([])
  const [filteredDetailsData, setFilteredDetailsData] = useState<ONWithDetails[]>([])

  const { data, error, isLoading, mutate } = useSWR("ons-data", fetcher, {
    refreshInterval: 60000, // Actualizar cada 60 segundos (1 minuto)
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  useEffect(() => {
    if (data?.flowsData) {
      setFilteredData(data.flowsData)
    }
    if (data?.flowsWithDetails) {
      setFilteredDetailsData(data.flowsWithDetails)
    }
  }, [data])

  const handleFiltersChange = (filters: {
    emisores?: string[]
    ticker?: string
    fechaDesde?: Date
    fechaHasta?: Date
  }) => {
    if (!data?.flowsData) return

    let filtered = [...data.flowsData]

    if (filters.emisores && filters.emisores.length > 0) {
      filtered = filtered.filter((flow) => filters.emisores!.includes(flow.emisor))
    }

    if (filters.ticker) {
      filtered = filtered.filter((flow) => flow.ticker.toLowerCase().includes(filters.ticker!.toLowerCase()))
    }

    if (filters.fechaDesde) {
      filtered = filtered.filter((flow) => new Date(flow.fecha_pago) >= filters.fechaDesde!)
    }

    if (filters.fechaHasta) {
      filtered = filtered.filter((flow) => new Date(flow.fecha_pago) <= filters.fechaHasta!)
    }

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

    if (filters.legislacion) {
      filtered = filtered.filter((flow) => flow.details?.legislacion === filters.legislacion)
    }

    if (filters.jurisdiccionPago) {
      filtered = filtered.filter((flow) => flow.details?.jurisdiccion_pago === filters.jurisdiccionPago)
    }

    if (filters.emisores && filters.emisores.length > 0) {
      filtered = filtered.filter((flow) => filters.emisores!.includes(flow.emisor))
    }

    if (filters.fechaVencimientoHasta) {
      filtered = filtered.filter((flow) => {
        if (!flow.details?.fecha_vencimiento) return false
        return new Date(flow.details.fecha_vencimiento) <= filters.fechaVencimientoHasta!
      })
    }

    setFilteredDetailsData(filtered)
  }

  const handleRefresh = () => {
    mutate()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Cargando dashboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error al cargar los datos</p>
          <Button onClick={handleRefresh}>Reintentar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                  <Home className="h-4 w-4" />
                  Inicio
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard de ONs</h1>
                <p className="text-slate-600">Análisis y seguimiento de flujos de Obligaciones Negociables</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/soberanos">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent border-green-200 text-green-700 hover:bg-green-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Soberanos HD
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                  <Settings className="h-4 w-4" />
                  Administración
                </Button>
              </Link>
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 bg-transparent"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Metrics */}
        {data && <ONSMetrics data={filteredData} />}

        {/* Tabs for different views */}
        <Tabs defaultValue="detalles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detalles">Detalles de ONs</TabsTrigger>
            <TabsTrigger value="flujos">Flujos de Pagos</TabsTrigger>
          </TabsList>

          <TabsContent value="detalles" className="space-y-6">
            {data && (
              <ONSDetailsFilters
                legislaciones={data.legislaciones}
                jurisdicciones={data.jurisdicciones}
                emisores={data.emisores}
                onFiltersChange={handleDetailsFiltersChange}
              />
            )}

            <ONDetailsTable flows={filteredDetailsData} />
          </TabsContent>

          <TabsContent value="flujos" className="space-y-6">
            {/* Filters */}
            {data && <ONSFilters emisores={data.emisores} onFiltersChange={handleFiltersChange} />}

            {/* Data Table */}
            <ONSTable data={filteredData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
