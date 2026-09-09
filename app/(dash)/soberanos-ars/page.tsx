"use client"

import { useState, useEffect } from "react"
import { SoberanosArsDetailsFilters } from "@/components/soberanos-ars-details-filters"
import { SoberanosArsDetailsTable } from "@/components/soberanos-ars-details-table"
import { CurvaForward } from "@/components/curva-forward"
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
        .from("instrument_flows")
        .select("*")
        // Las proyecciones CER son columnas de instrument_flows desde sql/011.
        // Antes el subset se elegía por tabla (instrument_flows_proyectados);
        // ahora se filtra: NULL significa "este símbolo no se proyecta".
        .not("total_proyectado", "is", null)
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

  const [allFlowsRaw, instrumentsResult, pricesResult, holidaysResult] = await Promise.all([
    fetchAllFlows(),
    supabase.from("instruments").select("*").eq("moneda_pago", "ARS").eq("is_active", true),
    supabase.from("prices").select("*"),
    supabase.from("holidays").select("holiday_date"),
  ])

  if (instrumentsResult.error) throw instrumentsResult.error
  if (pricesResult.error) throw pricesResult.error

  // La categoría sale de instruments.instrument_type, que es la columna donde ya
  // está resuelta. Antes se volvía a deducir acá desde `referencias`, y eso puso
  // a D10Y7 —dólar linked— en la solapa FIJA: vino del screener sin referencia,
  // y sin ella no era ni A3500 ni CER ni Tamar, así que caía en FIJA por
  // descarte. Deducir dos veces lo mismo en dos lugares distintos garantiza que
  // en algún momento no coincidan.
  //
  // moneda_pago=ARS incluye a los dólar linked, que tienen su propio dashboard.
  /**
   * Fecha de liquidación: T+1 hábil, el mismo criterio que lib/calendario.py.
   * Los días al vencimiento se cuentan desde acá y no desde hoy, porque es
   * desde acá que los motores miden la duración: para un bullet, la duración
   * en días y los días al vencimiento dan exactamente el mismo número, y
   * contando desde hoy quedaba uno arriba —o más, después de un fin de semana.
   */
  const feriados = new Set((holidaysResult.data || []).map((h: any) => String(h.holiday_date).slice(0, 10)))
  const esHabil = (d: Date) => {
    const dia = d.getUTCDay()
    return dia !== 0 && dia !== 6 && !feriados.has(d.toISOString().slice(0, 10))
  }
  const hoyAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    .format(new Date())
  const liquidacion = new Date(`${hoyAr}T00:00:00Z`)
  do { liquidacion.setUTCDate(liquidacion.getUTCDate() + 1) } while (!esHabil(liquidacion))
  const fechaLiquidacion = liquidacion.toISOString().slice(0, 10)

  const instrumentsData = (instrumentsResult.data || [])
    .filter((i: any) => i.instrument_type !== "DLK")
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
    // ratio CER aplicable = total_proyectado / total (constante por bono en v3);
    // CER t-10 = ratio × cer_emision
    const ratioCer =
      flow.total_proyectado != null && Number(flow.total) !== 0
        ? Number(flow.total_proyectado) / Number(flow.total)
        : null
    const cerT10 =
      ratioCer != null && instr?.cer_emision ? ratioCer * Number(instr.cer_emision) : null
    return {
      ...flow,
      ticker: flow.symbol,
      emisor: instr?.emisor || "Tesoro Argentino",
      details: instr ? {
        ticker:            instr.symbol,
        instrument_type:   instr.instrument_type,
        cer_t10:           cerT10,
        ratio_cer:         ratioCer,
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

  return { fechaLiquidacion, flowsWithDetails, emisores: uniqueEmisores, tipos: uniqueTipos, monedas: uniqueMonedas }
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
              <SoberanosArsDetailsTable flows={filteredDetailsData} activeTab={activeTab} fechaLiquidacion={data.fechaLiquidacion} />
              <CurvaForward
                flows={data.flowsWithDetails}
                titulo="Soberanos CER · TIR real"
                grupos={[{ key: "cer", nombre: "CER", incluye: (f) => f?.details?.instrument_type === "CER" }]}
              />
            </TabsContent>
            <TabsContent value="FIJA" className="space-y-6">
              <SoberanosArsDetailsFilters monedas={data.monedas} emisores={data.emisores} onFiltersChange={handleDetailsFiltersChange} />
              <SoberanosArsDetailsTable flows={filteredDetailsData} activeTab={activeTab} fechaLiquidacion={data.fechaLiquidacion} />
              <CurvaForward
                flows={data.flowsWithDetails}
                titulo="Soberanos tasa fija · TIR nominal"
                grupos={[{ key: "fija", nombre: "FIJA", incluye: (f) => f?.details?.instrument_type === "FIJA" }]}
              />
            </TabsContent>
            <TabsContent value="TAMAR" className="space-y-6">
              <SoberanosArsDetailsFilters monedas={data.monedas} emisores={data.emisores} onFiltersChange={handleDetailsFiltersChange} />
              <SoberanosArsDetailsTable flows={filteredDetailsData} activeTab={activeTab} fechaLiquidacion={data.fechaLiquidacion} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
