"use client"

/**
 * Breakevens: qué inflación, devaluación o tasa descuenta el mercado al
 * comparar dos curvas en pesos. Por ahora sólo CER contra fija; dólar linked
 * y TAMAR contra fija van como solapas cuando se armen.
 */

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BreakevenCerFija, type RemData } from "@/components/breakeven-cer-fija"
import { createClient } from "@/lib/supabase/client"
import type { BonoBe } from "@/lib/breakeven"
import { Loader2, RefreshCw } from "lucide-react"
import useSWR from "swr"

const fetcher = async () => {
  const supabase = createClient()
  const [instrumentos, precios, feriados, remRes] = await Promise.all([
    supabase.from("instruments")
      .select("symbol,instrument_type,vencimiento")
      .eq("moneda_pago", "ARS").eq("is_active", true)
      .in("instrument_type", ["CER", "FIJA"]),
    supabase.from("prices").select("symbol,ytm,ytm_tipo,duration_y,cer_fixed"),
    supabase.from("holidays").select("holiday_date"),
    fetch("/api/rem").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<RemData | null>,
  ])
  if (instrumentos.error) throw instrumentos.error
  if (precios.error) throw precios.error

  // Liquidación T+1 hábil, mismo criterio que soberanos-ars y lib/calendario.py.
  const hol = new Set((feriados.data ?? []).map((h: any) => String(h.holiday_date).slice(0, 10)))
  const esHabil = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !hol.has(d.toISOString().slice(0, 10))
  const hoyAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())
  const liq = new Date(`${hoyAr}T00:00:00Z`)
  do { liq.setUTCDate(liq.getUTCDate() + 1) } while (!esHabil(liq))
  const fechaLiquidacion = liq.toISOString().slice(0, 10)

  const px = new Map((precios.data ?? []).map((p: any) => [p.symbol, p]))
  const fija: BonoBe[] = []
  const cer: BonoBe[] = []
  const cerFijados: string[] = []
  for (const i of (instrumentos.data ?? []) as any[]) {
    const p = px.get(i.symbol)
    if (!p || p.ytm == null || !(Number(p.duration_y) > 0) || !i.vencimiento) continue
    const b: BonoBe = { symbol: i.symbol, vto: String(i.vencimiento).slice(0, 10), dur: Number(p.duration_y), ytm: Number(p.ytm) }
    if (i.instrument_type === "FIJA") fija.push(b)
    else if (p.cer_fixed) cerFijados.push(i.symbol)
    else cer.push(b)
  }
  cer.sort((a, b) => a.dur - b.dur)
  fija.sort((a, b) => a.dur - b.dur)

  const vtosCer = new Set(cer.map((c) => c.vto))
  return { fechaLiquidacion, fija, cer, cerFijados, pares: fija.filter((f) => vtosCer.has(f.vto)).length, rem: remRes }
}

export default function BreakevensPage() {
  const { data, error, isLoading, mutate } = useSWR("breakevens-data", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2"><Loader2 className="h-6 w-6 animate-spin" /><span>Cargando breakevens...</span></div>
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
              <h1 className="text-3xl font-bold text-foreground mb-2">Breakevens</h1>
              <p className="text-muted-foreground">Lo que descuenta el mercado entre curvas en pesos</p>
            </div>
            <Button onClick={() => mutate()} variant="outline" size="sm" className="flex items-center gap-2 bg-transparent" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Actualizar
            </Button>
          </div>
        </div>

        {data && (
          <Tabs defaultValue="cer" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="cer">CER / Fija · inflación ({data.pares})</TabsTrigger>
            </TabsList>
            <TabsContent value="cer">
              <BreakevenCerFija
                fija={data.fija}
                cer={data.cer}
                cerFijados={data.cerFijados}
                fechaLiquidacion={data.fechaLiquidacion}
                rem={data.rem}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
