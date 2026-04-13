"use client"

import { useState, useEffect } from "react"
import { SoberanosDetailsFilters } from "@/components/soberanos-details-filters"
import { SoberanosDetailsTable } from "@/components/soberanos-details-table"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { SoberanoWithDetails } from "@/lib/types"
import { Loader2, Home, TrendingUp, RefreshCw } from "lucide-react"
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
        .from("soberanos_flows")
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
    supabase.from("soberanos_details").select("*"),
    supabase.from("last_prices").select("*"),
  ])

  if (detailsResult.error) throw detailsResult.error
  if (pricesResult.error) throw pricesResult.error

  const detailsData = detailsResult.data || []
  const pricesData = pricesResult.data || []

  const detailsMap = new Map(detailsData.map((detail) => [detail.ticker, detail]))
  const pricesMap = new Map(pricesData.map((price) => [price.symbol, price]))

  // Obtener el flujo más reciente por ticker
  const flowsByTicker = new Map<string, any>()
  flowsData.forEach((flow) => {
    const existingFlow = flowsByTicker.get(flow.ticker)
    if (!existingFlow || new Date(flow.fecha_pago) > new Date(existingFlow.fecha_pago)) {
      flowsByTicker.set(flow.ticker, flow)
    }
  })

  const uniqueFlows = Array.from(flowsByTicker.values())
  const flowsWithDetails: SoberanoWithDetails[] = uniqueFlows.map((flow) => ({
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
    flowsWithDetails,
    emisores: uniqueEmisores,
    legislaciones: uniqueLegislaciones,
    jurisdicciones: uniqueJurisdicciones,
  }
}

export default function SoberanosDashboard() {
  const [filteredDetailsData, setFilteredDetailsData] = useState<SoberanoWithDetails[]>([])

  const { data, error, isLoading, mutate } = useSWR("soberanos-data", fetcher, {
    refreshInterval: 60000, // Actualizar cada 60 segundos (1 minuto)
    revalidateOnFocus: true, // Actualizar cuando la ventana recibe foco
    revalidateOnReconnect: true, // Actualizar cuando se reconecta
  })

  useEffect(() => {
    if (data?.flowsWithDetails) {
      setFilteredDetailsData(data.flowsWithDetails)
    }
  }, [data])

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
          <span>Cargando dashboard de Soberanos...</span>
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
              <Link href="/ons">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <TrendingUp className="h-4 w-4" />
                  Dashboard ONs
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard de Soberanos Hard Dollar</h1>
                <p className="text-slate-600">Análisis y seguimiento de Soberanos en dólares estadounidenses</p>
              </div>
            </div>
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

        {/* Filters */}
        {data && (
          <SoberanosDetailsFilters
            legislaciones={data.legislaciones}
            jurisdicciones={data.jurisdicciones}
            emisores={data.emisores}
            onFiltersChange={handleDetailsFiltersChange}
          />
        )}

        {/* Data Table */}
        <SoberanosDetailsTable flows={filteredDetailsData} />
      </div>
    </div>
  )
}
