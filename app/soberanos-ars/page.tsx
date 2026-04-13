"use client"

import { useState, useEffect } from "react"
import { SoberanosArsDetailsFilters } from "@/components/soberanos-ars-details-filters"
import { SoberanosArsDetailsTable } from "@/components/soberanos-ars-details-table"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import type { SoberanoWithDetails } from "@/lib/types"
import { Loader2, Home, TrendingUp, RefreshCw, PiggyBank } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"

const fetcher = async () => {
  console.log("[v0] Starting data fetch for Soberanos ARS")
  const supabase = createClient()

  console.log("[v0] Testing direct query to soberanos_ars_flows")
  const testQuery = await supabase.from("soberanos_ars_flows").select("*").limit(5)

  console.log("[v0] Test query result:", testQuery.data?.length || 0, "records")
  console.log("[v0] Test query error:", testQuery.error)
  console.log("[v0] First few records:", testQuery.data?.slice(0, 2))

  const fetchAllFlows = async () => {
    console.log("[v0] Fetching flows from soberanos_ars_flows")
    let allFlows: any[] = []
    let start = 0
    const batchSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from("soberanos_ars_flows")
        .select("*")
        .order("fecha_pago", { ascending: true })
        .range(start, start + batchSize - 1)

      if (error) {
        console.log("[v0] Error fetching flows:", error)
        throw error
      }
      if (!data || data.length === 0) break

      allFlows = [...allFlows, ...data]

      if (data.length < batchSize) break
      start += batchSize
    }

    console.log("[v0] Total flows fetched:", allFlows.length)
    return allFlows
  }

  const [flowsData, detailsResult, pricesResult] = await Promise.all([
    fetchAllFlows(),
    supabase.from("soberanos_ars_details").select("*"),
    supabase.from("last_prices").select("*"),
  ])

  console.log("[v0] Details result:", detailsResult.data?.length || 0, "records")
  console.log("[v0] Prices result:", pricesResult.data?.length || 0, "records")

  if (detailsResult.error) {
    console.log("[v0] Error fetching details:", detailsResult.error)
    throw detailsResult.error
  }
  if (pricesResult.error) {
    console.log("[v0] Error fetching prices:", pricesResult.error)
    throw pricesResult.error
  }

  const detailsData = detailsResult.data || []
  const pricesData = pricesResult.data || []

  console.log(
    "[v0] Processing data - flows:",
    flowsData.length,
    "details:",
    detailsData.length,
    "prices:",
    pricesData.length,
  )

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
  console.log("[v0] Unique flows after processing:", uniqueFlows.length)

  const flowsWithDetails: SoberanoWithDetails[] = uniqueFlows.map((flow) => ({
    ...flow,
    details: detailsMap.get(flow.ticker) || null,
    lastPrice: pricesMap.get(flow.ticker) || null,
  }))

  console.log("[v0] Final flows with details:", flowsWithDetails.length)

  const uniqueEmisores = [...new Set(flowsData.map((flow) => flow.emisor))].sort()
  const uniqueTipos = [...new Set(detailsData.map((detail) => detail.tipo).filter(Boolean))].sort()
  const uniqueMonedas = [...new Set(detailsData.map((detail) => detail.moneda).filter(Boolean))].sort()

  console.log("[v0] Unique emisores:", uniqueEmisores.length)
  console.log("[v0] Unique tipos:", uniqueTipos.length)
  console.log("[v0] Unique monedas:", uniqueMonedas.length)

  return {
    flowsWithDetails,
    emisores: uniqueEmisores,
    tipos: uniqueTipos,
    monedas: uniqueMonedas,
  }
}

export default function SoberanosArsDashboard() {
  const [filteredDetailsData, setFilteredDetailsData] = useState<SoberanoWithDetails[]>([])
  const [activeTab, setActiveTab] = useState<string>("CER")

  const { data, error, isLoading, mutate } = useSWR("soberanos-ars-data", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  useEffect(() => {
    if (data?.flowsWithDetails) {
      const filtered = data.flowsWithDetails.filter((flow) => flow.details?.tipo === activeTab)
      setFilteredDetailsData(filtered)
    }
  }, [data, activeTab])

  const handleDetailsFiltersChange = (filters: {
    moneda?: string
    emisores?: string[]
    fechaVencimientoHasta?: Date
  }) => {
    if (!data?.flowsWithDetails) return

    let filtered = data.flowsWithDetails.filter((flow) => flow.details?.tipo === activeTab)

    if (filters.moneda) {
      filtered = filtered.filter((flow) => flow.details?.moneda === filters.moneda)
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
          <span>Cargando dashboard de Soberanos ARS...</span>
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
              <Link href="/soberanos">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent border-green-200 text-green-700 hover:bg-green-50"
                >
                  <PiggyBank className="h-4 w-4" />
                  Soberanos HD
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard de Soberanos ARS</h1>
                <p className="text-slate-600">Análisis y seguimiento de Soberanos en pesos argentinos</p>
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

        {/* Tabs */}
        {data && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="CER" className="text-sm font-medium">
                CER ({data.flowsWithDetails.filter((f) => f.details?.tipo === "CER").length})
              </TabsTrigger>
              <TabsTrigger value="Fija" className="text-sm font-medium">
                FIJA ({data.flowsWithDetails.filter((f) => f.details?.tipo === "Fija").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="CER" className="space-y-6">
              <SoberanosArsDetailsFilters
                monedas={data.monedas}
                emisores={data.emisores}
                onFiltersChange={handleDetailsFiltersChange}
              />
              <SoberanosArsDetailsTable flows={filteredDetailsData} />
            </TabsContent>

            <TabsContent value="Fija" className="space-y-6">
              <SoberanosArsDetailsFilters
                monedas={data.monedas}
                emisores={data.emisores}
                onFiltersChange={handleDetailsFiltersChange}
              />
              <SoberanosArsDetailsTable flows={filteredDetailsData} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
