"use client"

import { useState, useMemo } from "react"
import { ONSFilters } from "@/components/ons-filters"
import { ONSDetailsFilters } from "@/components/ons-details-filters"
import { ONSTable } from "@/components/ons-table"
import { ONSMetrics } from "@/components/ons-metrics"
import { ONDetailsTable } from "@/components/ons-details-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { ONWithDetails } from "@/lib/types"
import { Loader2, RefreshCw } from "lucide-react"
import useSWR from "swr"

const fetcherDe = async (tipo: string) => {
  const supabase = createClient()

  // Fetch flows paginado desde instrument_flows_v2
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
    supabase.from("instruments").select("*").eq("instrument_type", tipo).eq("is_active", true),
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

  // Cómo se ajusta el capital: es lo que separa una ON de otra al compararlas.
  // Sin ajuste, decide la moneda en que paga.
  const AJUSTE_POR_REFERENCIA: Record<string, string> = {
    A3500: "Dólar linked", Tamar: "TAMAR", CER: "CER", Badlar: "BADLAR", Dual: "Dual",
  }
  const ajusteDe = (instr: any): string =>
    AJUSTE_POR_REFERENCIA[instr?.referencias] ??
    (instr?.moneda_pago === "USD" ? "Hard dollar" : "Tasa fija")

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
        vencimiento:       instr.vencimiento,
        legislacion:       instr.legislacion,
        jurisdiccion_pago: instr.jurisdiccion_pago,
        lamina_min:        instr.lamina_min,
        callable:          instr.callable,
        vr_vigente:        instr.vr_vigente,
        moneda_pago:       instr.moneda_pago,
        tipo_cupon:        instr.tipo_cupon,
        denominacion:      instr.denominacion,
        isin:              instr.isin,
        convencion_int:    instr.convencion_int,
        periodicidad_int:  instr.periodicidad_int,
        operacion_min:     instr.operacion_min,
        vn_vigente:        instr.vn_vigente,
        valor_residual:    instr.valor_residual,
        tasa_int:          instr.tasa_int,
        emision:           instr.emision,
        ticker_usd:        instr.ticker_usd,
        referencias:       instr.referencias,
        margen_ref:        instr.margen_ref,
        ajuste:            ajusteDe(instr),
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
  // Las más comunes primero; las que no estén en la lista, al final.
  const ORDEN_AJUSTES = ["Hard dollar", "Dólar linked", "TAMAR", "Tasa fija", "CER", "BADLAR", "Dual"]
  const uniqueAjustes = [...new Set(instrumentsData.map(ajusteDe))].sort(
    (a, b) => (ORDEN_AJUSTES.indexOf(a) + 1 || 99) - (ORDEN_AJUSTES.indexOf(b) + 1 || 99),
  )

  return {
    flowsData: allFlowsAdapted,
    flowsWithDetails,
    emisores: uniqueEmisores,
    legislaciones: uniqueLegislaciones,
    jurisdicciones: uniqueJurisdicciones,
    ajustes: uniqueAjustes,
  }
}

type FlowsFilters = { emisores?: string[]; ticker?: string; fechaDesde?: Date; fechaHasta?: Date }
type DetailsFilters = {
  ajuste?: string
  legislacion?: string
  jurisdiccionPago?: string
  emisores?: string[]
  fechaVencimientoHasta?: Date
}

type Props = {
  /** instruments.instrument_type que lista la página: "ON", "SUBSOB". */
  tipo: string
  titulo: string
  subtitulo: string
  /** Cómo se nombran en plural en los contadores: "ONs", "provinciales". */
  unidad: string
  /** Prefijo de la clave de SWR y de los filtros guardados en localStorage. */
  clave: string
}

/**
 * Tablero de bonos con flujos: detalle por bono + flujos de pago, con filtros.
 * Lo usan ONs y Provinciales, que se leen igual y sólo cambian de universo.
 */
export function BonosDashboard({ tipo, titulo, subtitulo, unidad, clave }: Props) {
  // Se guardan los FILTROS, no las filas filtradas: si se guardaran las filas,
  // cada refresco de SWR (30 s) las pisaría con el universo entero.
  const [flowsFilters, setFlowsFilters] = useState<FlowsFilters>({})
  const [detailsFilters, setDetailsFilters] = useState<DetailsFilters>({})

  const { data, error, isLoading, mutate } = useSWR(`${clave}-data`, () => fetcherDe(tipo), {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  const filteredData = useMemo(() => {
    const filters = flowsFilters
    if (!data?.flowsData) return []
    let filtered = [...data.flowsData]
    if (filters.emisores?.length) filtered = filtered.filter((f) => filters.emisores!.includes(f.emisor))
    if (filters.ticker) filtered = filtered.filter((f) => f.ticker.toLowerCase().includes(filters.ticker!.toLowerCase()))
    if (filters.fechaDesde) filtered = filtered.filter((f) => new Date(f.fecha_pago) >= filters.fechaDesde!)
    if (filters.fechaHasta) filtered = filtered.filter((f) => new Date(f.fecha_pago) <= filters.fechaHasta!)
    return filtered
  }, [data, flowsFilters])

  const filteredDetailsData = useMemo(() => {
    const filters = detailsFilters
    if (!data?.flowsWithDetails) return []
    let filtered = [...data.flowsWithDetails]
    if (filters.ajuste) filtered = filtered.filter((f) => f.details?.ajuste === filters.ajuste)
    if (filters.legislacion) filtered = filtered.filter((f) => f.details?.legislacion === filters.legislacion)
    if (filters.jurisdiccionPago) filtered = filtered.filter((f) => f.details?.jurisdiccion_pago === filters.jurisdiccionPago)
    if (filters.emisores?.length) filtered = filtered.filter((f) => filters.emisores!.includes(f.emisor))
    if (filters.fechaVencimientoHasta) {
      filtered = filtered.filter((f) => {
        if (!f.details?.vencimiento) return false
        return new Date(f.details.vencimiento) <= filters.fechaVencimientoHasta!
      })
    }
    return filtered
  }, [data, detailsFilters])

  const handleFiltersChange = (filters: FlowsFilters) => setFlowsFilters(filters)
  const handleDetailsFiltersChange = (filters: DetailsFilters) => setDetailsFilters(filters)

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Cargando dashboard...</span>
      </div>
    </div>
  )

  // Un refresco fallido con datos ya cargados no tira la pantalla: SWR conserva
  // `data`, y volver a montar todo borraba la búsqueda, el orden y el agrupado.
  if (error && !data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-destructive mb-4">Error al cargar los datos</p>
        <Button onClick={() => mutate()}>Reintentar</Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{titulo}</h1>
              <p className="text-muted-foreground">{subtitulo}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => mutate()} variant="outline" size="sm" className="flex items-center gap-2 bg-transparent" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Actualizar
              </Button>
            </div>
          </div>
        </div>

        {data && <ONSMetrics data={filteredData} unidad={unidad} />}

        <Tabs defaultValue="detalles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detalles">Detalles de {unidad}</TabsTrigger>
            <TabsTrigger value="flujos">Flujos de Pagos</TabsTrigger>
          </TabsList>
          <TabsContent value="detalles" className="space-y-6">
            {data && <ONSDetailsFilters storageKey={`${clave}DetailsFilters`} unidad={unidad} ajustes={data.ajustes} legislaciones={data.legislaciones} jurisdicciones={data.jurisdicciones} emisores={data.emisores} onFiltersChange={handleDetailsFiltersChange} />}
            <ONDetailsTable flows={filteredDetailsData} unidad={unidad} />
          </TabsContent>
          <TabsContent value="flujos" className="space-y-6">
            {data && <ONSFilters storageKey={`${clave}Filters`} emisores={data.emisores} onFiltersChange={handleFiltersChange} />}
            <ONSTable data={filteredData} unidad={unidad} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
