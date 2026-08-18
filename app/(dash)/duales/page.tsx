"use client"

import { useState } from "react"
import { DualesTable } from "@/components/duales-table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import type { DualRow } from "@/lib/types"
import { Loader2, RefreshCw, Split } from "lucide-react"
import useSWR from "swr"

// Esta página NO se arma desde instrument_flows_v3 como la de soberanos ARS:
// los duales son bullet y no tienen flujos cargados. Sale de v_duales, que
// pivotea `valuations` (una fila por symbol/leg/escenario) contra
// instrument_legs. Ver marketweb/sql/001_patas_duales.sql.
const fetcher = async ([, scenario]: [string, string]) => {
  const supabase = createClient()

  const [dualesRes, kindsRes, instrumentsRes, pricesRes, scenariosRes] = await Promise.all([
    supabase.from("v_duales").select("*").eq("scenario", scenario),
    supabase.from("v_instrument_kind").select("*").gt("n_patas", 1),
    supabase.from("instruments_v2").select("*").eq("is_active", true),
    supabase.from("prices").select("*"),
    supabase.from("scenarios").select("*").order("id"),
  ])

  for (const r of [dualesRes, kindsRes, instrumentsRes, pricesRes, scenariosRes]) {
    if (r.error) throw r.error
  }

  const kinds = new Map((kindsRes.data ?? []).map((k: any) => [k.symbol, k.kind]))
  const instruments = new Map((instrumentsRes.data ?? []).map((i: any) => [i.symbol, i]))
  const prices = new Map((pricesRes.data ?? []).map((p: any) => [p.symbol, p]))

  const rows: DualRow[] = (dualesRes.data ?? []).map((d: any) => {
    const inst = instruments.get(d.symbol)
    const px = prices.get(d.symbol)
    return {
      symbol:   d.symbol,
      scenario: d.scenario,
      ganadora: d.ganadora,
      vpv_max:  d.vpv_max,
      patas:    d.patas ?? {},
      ts:       d.ts,
      kind:     kinds.get(d.symbol) ?? "DUAL",
      details: inst
        ? {
            denominacion: inst.denominacion,
            emision:      inst.emision,
            vencimiento:  inst.vencimiento,
            moneda_denom: inst.moneda_denom,
            margen_ref:   inst.margen_ref,
            cer_emision:  inst.cer_emision,
          }
        : null,
      lastPrice: px
        ? {
            price_ars:     px.price_ars,
            closing_price: px.closing_price,
            change_pct:    px.change_pct,
            ytm:           px.ytm,
            ytm_ars:       px.ytm_ars,
            duration_y:    px.duration_y,
            paridad:       px.paridad,
            ts:            px.ts,
          }
        : null,
    }
  })

  // `scenarios`, `v_duales` y `v_instrument_kind` no están en los tipos
  // generados de Supabase, así que sin el cast resuelven a `never`.
  return { rows, scenarios: (scenariosRes.data ?? []) as any[] }
}

export default function DualesPage() {
  const [scenario, setScenario] = useState("base")
  const { data, error, isLoading, mutate, isValidating } = useSWR(
    ["duales", scenario],
    fetcher,
    { revalidateOnFocus: false },
  )

  const activo = data?.scenarios?.find((s: any) => s.id === scenario)

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Split className="h-6 w-6 text-lb-violet-accent" />
            Duales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tasa fija/TAMAR, CER/TAMAR y TAMAR/dólar linked. Cada pata valuada por separado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* El escenario cambia la proyección de cada pata, y con eso el
              breakeven. Compará `base` (TAMAR por últimos-5, la convención de
              mercado) contra `rem_p50` para ver cuánto pesa ese supuesto. */}
          <Select value={scenario} onValueChange={setScenario}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Escenario" />
            </SelectTrigger>
            <SelectContent>
              {(data?.scenarios ?? [{ id: "base", nombre: "Base" }]).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.nombre ?? s.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
            <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {activo?.fuente && (
        <p className="text-xs text-muted-foreground -mt-3">
          Supuestos del escenario: {activo.fuente}
        </p>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Error al cargar: {String(error.message ?? error)}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      )}

      {data && <DualesTable rows={data.rows} />}
    </div>
  )
}
