"use client"

import { useState, useEffect } from "react"
import { SoberanosArsDetailsFilters } from "@/components/soberanos-ars-details-filters"
import { SoberanosArsDetailsTable } from "@/components/soberanos-ars-details-table"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import type { SoberanoWithDetails } from "@/lib/types"
import { Loader2, RefreshCw } from "lucide-react"
import useSWR from "swr"

const fetcher = async () => {
  const supabase = createClient()

  const fetchAllFlows = async () => {
    let allFlows: any[] = []
    let start = 0
    const batchSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from("instrument_flows_v2")
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
    supabase.from("instruments_v2").select("*").eq("moneda_pago", "ARS").eq("is_active", true),
    supabase.from("prices").select("*"),
  ])

  if (instrumentsResult.error) throw instrumentsResult.error
  if (pricesResult.error) throw pricesResult.error

  // Categoría del tab según la referencia de tasa (instruments_v2.referencias)
  const categoriaArs = (ref: string | null) =>
    ref === "CER" ? "CER" : ref === "Tamar" ? "TAMAR" : ref === "A3500" ? "DLK" : "FIJA"

  // moneda_pago=ARS incluye dólar-linked (referencias=A3500); esos van al dashboard DLK, acá se excluyen
  const instrumentsData = (instrumentsResult.data || []).filter((i: any) => i.referencias !== "A3500")
  const pricesData = pricesResult.data || []

  const arsSymbols = new Set(instrumentsData.map((i: any) => i.symbol))
  const flowsData = allFlowsRaw.filter((f: any) => arsSymbols.has(f.symbol))

  const instrumentsMap = new Map(instrumentsData.map((i: any) => [i.symbol, i]))
  const pricesMap = new Map(pricesData.map((p: any) => [p.symbol, p]))

  const byTicker = new Map<string, any>()
  flowsData.forEach((flow: any) => {
    const existing = byTicker.get(flow.symbol)
    if (!existing || new Date(flow.fecha_pago) > new Date(existing.fecha_pago)) {
      byTicker.set(flow.symbol, flow)
    }
  })

  const flowsWithDetails: SoberanoWithDetails[] = Array.from(byTicker.values()).map((flow: any) => {
    const instr = instrumentsMap.get(flow.symbol) as any
    const price = pricesMap.get(flow.symbol) as any
    return {
      ...flow,
      ticker: flow.symbol,
      emisor: instr?.emisor || "Tesoro Argentino",
      details: instr ? {
        ticker:            instr.symbol,
        instrument_type:   categoriaArs(instr.referencias),
        vencimiento:       instr.vencimiento,
        legislacion:       instr.legislacion,
        jurisdiccion_pago: instr.jurisdiccion_pago,
        lamina_min:        instr.lamina_min,
        callable:          instr.callable,
        vr_vigente:        instr.vr_vigente,
        moneda_denom:      instr.moneda_denom,
        moneda_pago:       instr.moneda_pago,
        tipo_cupon:        instr.tipo_cupon,
        cer_emision:       instr.cer_emision,
        denominacion:      instr.denominacion,
        isin:              instr.isin,
        convencion_int:    instr.convencion_int,
        periodicidad_int:  instr.periodicidad_int,
        operacion_min:     instr.operacion_min,
        valor_residual:    instr.valor_residual,
        tasa_int:          instr.tasa_int,
        emision:           instr.emision,
        ticker_usd:        instr.ticker_usd,
        referencias:       instr.referencias,
        margen_ref:        instr.margen_ref,
      } : null,
      lastPrice: price ? {
        ...price,
        change:    price.change_pct,
        last:      price.price_ars ?? price.closing_price,
        price_usd: price.last,
      } : null,
    }
  })

  const uniqueEmisores = [...new Set(instrumentsData.map((i: any) => i.emisor).filter(Boolean))].sort() as string[]
  const uniqueTipos = [...new Set(instrumentsData.map((i: any) => i.tipo_cupon).filter(Boolean))].sort() as string[]
  const uniqueMonedas = [...new Set(instrumentsData.map((i: any) => i.moneda_denom).filter(Boolean))].sort() as string[]

  return { flowsWithDetails, emisores: uniqueEmisores, tipos: uniqueTipos, monedas: uniqueMonedas }
}

export default function SoberanosArsDashboard() {
  const [filteredDetailsData, setFilteredDetailsData] = useState<SoberanoWithDetails[]>([])
  const [activeTab, setActiveTab] = useState<string>("CER")

  const { data, error, isLoading, mutate } = useSWR("soberanos-ars-data", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  useEffect(() => {
    if (data?.flowsWithDetails) {
      setFilteredDetailsData(data.flowsWithDetails.filter((f) => f.details?.instrument_type === activeTab))
    }
  }, [data, activeTab])

  const handleDetailsFiltersChange = (filters: { moneda?: string; emisores?: string[]; fechaVencimientoHasta?: Date }) => {
    if (!data?.flowsWithDetails) return
    let filtered = data.flowsWithDetails.filter((f) => f.details?.instrument_type === activeTab)
    if (filters.moneda) filtered = filtered.filter((f) => f.details?.moneda_denom === filters.moneda)
    if (filters.emisores?.length) filtered = filtered.filter((f) => filters.emisores!.includes(f.emisor))
    if (filters.fechaVencimientoHasta) {
      filtered = filtered.filter((f) => {
        if (!f.details?.vencimiento) return false
        return new Date(f.details.vencimiento) <= filters.fechaVencimientoHasta!
      })
    }
    setFilteredDetailsData(filtered)
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2"><Loader2 className="h-6 w-6 animate-spin" /><span>Cargando dashboard de Soberanos ARS...</span></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><p className="text-destructive mb-4">Error al cargar los datos</p><Button onClick={() => mutate()}>Reintentar</Button></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard de Soberanos ARS</h1>
              <p className="text-muted-foreground">Análisis y seguimiento de Soberanos en pesos argentinos</p>
            </div>
            <Button onClick={() => mutate()} variant="outline" size="sm" className="flex items-center gap-2 bg-transparent" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Actualizar
            </Button>
          </div>
        </div>

        {data && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="CER">CER ({data.flowsWithDetails.filter((f) => f.details?.instrument_type === "CER").length})</TabsTrigger>
              <TabsTrigger value="FIJA">FIJA ({data.flowsWithDetails.filter((f) => f.details?.instrument_type === "FIJA").length})</TabsTrigger>
              <TabsTrigger value="TAMAR">TAMAR ({data.flowsWithDetails.filter((f) => f.details?.instrument_type === "TAMAR").length})</TabsTrigger>
            </TabsList>
            <TabsContent value="CER" className="space-y-6">
              <SoberanosArsDetailsFilters monedas={data.monedas} emisores={data.emisores} onFiltersChange={handleDetailsFiltersChange} />
              <SoberanosArsDetailsTable flows={filteredDetailsData} activeTab={activeTab} />
            </TabsContent>
            <TabsContent value="FIJA" className="space-y-6">
              <SoberanosArsDetailsFilters monedas={data.monedas} emisores={data.emisores} onFiltersChange={handleDetailsFiltersChange} />
              <SoberanosArsDetailsTable flows={filteredDetailsData} activeTab={activeTab} />
            </TabsContent>
            <TabsContent value="TAMAR" className="space-y-6">
              <SoberanosArsDetailsFilters monedas={data.monedas} emisores={data.emisores} onFiltersChange={handleDetailsFiltersChange} />
              <SoberanosArsDetailsTable flows={filteredDetailsData} activeTab={activeTab} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
