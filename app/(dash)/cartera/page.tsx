"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Wallet, Loader2, Check, AlertTriangle } from "lucide-react"

const STORAGE_KEY = "lb-cartera-v1"

type Period = "fecha" | "mes" | "anio"

type InstrumentLite = {
  symbol: string
  instrument_type: string
  emisor: string | null
  moneda_pago: string | null
  jurisdiccion_pago: string | null
  lamina_min: number | null
  vencimiento: string | null
}

type FlowRow = {
  symbol: string
  fecha_pago: string
  interes: number | null
  amortizacion: number | null
  total: number | null
  moneda_pago: string | null
}

type Holding = { symbol: string; vn: number }

const TYPE_LABEL: Record<string, string> = {
  ON: "ON",
  HD: "Soberano HD",
  ARS: "Soberano ARS",
  DLK: "Dólar Linked",
}

function typeLabel(t: string | null | undefined) {
  if (t && TYPE_LABEL[t]) return TYPE_LABEL[t]
  return t || "Bono"
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

const nf = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 })

function normCurrency(c: string | null | undefined) {
  return (c || "—").trim().toUpperCase()
}

// En pesos la jurisdicción siempre es Argentina (no se muestra). En USD puede
// ser Argentina o Nueva York, así que ahí sí separamos por jurisdicción.
function esPesos(cur: string) {
  return cur.includes("ARS") || cur.includes("PES") || cur === "$"
}

// fecha_pago llega como "YYYY-MM-DD"; agrupamos por substring para evitar líos de timezone
function periodKey(iso: string, period: Period): { key: string; label: string } {
  if (period === "anio") return { key: iso.slice(0, 4), label: iso.slice(0, 4) }
  if (period === "mes") {
    const y = iso.slice(0, 4)
    const m = Number(iso.slice(5, 7))
    return { key: iso.slice(0, 7), label: `${MESES[m - 1] ?? "?"} ${y}` }
  }
  const [y, m, d] = iso.split("-")
  return { key: iso, label: `${d}/${m}/${y}` }
}

type Agg = { interes: number; amortizacion: number; total: number }
type Row = Agg & { key: string; label: string }
type FlowBlock = {
  id: string
  currency: string
  jurisdiccion: string | null
  label: string
  rows: Row[]
  totals: Agg
  pagos: number
}

export default function CarteraPage() {
  const supabase = useMemo(() => createClient(), [])

  const [instruments, setInstruments] = useState<InstrumentLite[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [flows, setFlows] = useState<FlowRow[]>([])
  const [period, setPeriod] = useState<Period>("mes")
  const [loadingInstr, setLoadingInstr] = useState(true)
  const [loadingFlows, setLoadingFlows] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [soloFuturos, setSoloFuturos] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  // ── Cargar / persistir cartera en localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setHoldings(JSON.parse(raw))
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
    } catch {
      /* ignore */
    }
  }, [holdings, hydrated])

  // ── Traer instrumentos (bonos con flujos) ──
  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoadingInstr(true)
      try {
        // Traemos todos los bonos activos (todo menos FX, que es el dólar y no tiene cupones).
        // No filtramos por instrument_type porque los soberanos ARS no están tipados "ARS"
        // (se identifican por moneda_pago), así que con .neq("FX") entran ON/HD/ARS/DLK.
        const { data, error } = await supabase
          .from("instruments_v2")
          .select("symbol, instrument_type, emisor, moneda_pago, jurisdiccion_pago, lamina_min, vencimiento")
          .or("instrument_type.neq.FX,instrument_type.is.null")
          .eq("is_active", true)
        if (!cancel && !error && data) {
          setInstruments(
            (data as InstrumentLite[]).slice().sort((a, b) => a.symbol.localeCompare(b.symbol)),
          )
        }
      } catch {
        /* sin env / sin datos */
      } finally {
        if (!cancel) setLoadingInstr(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [supabase])

  // ── Traer flujos de los símbolos de la cartera (paginado) ──
  const symbolsKey = holdings.map((h) => h.symbol).sort().join(",")
  useEffect(() => {
    const symbols = symbolsKey ? symbolsKey.split(",") : []
    if (symbols.length === 0) {
      setFlows([])
      return
    }
    let cancel = false
    ;(async () => {
      setLoadingFlows(true)
      let all: FlowRow[] = []
      try {
        let start = 0
        const batch = 1000
        while (true) {
          const { data, error } = await supabase
            .from("instrument_flows_v2")
            .select("symbol, fecha_pago, interes, amortizacion, total, moneda_pago")
            .in("symbol", symbols)
            .order("fecha_pago", { ascending: true })
            .range(start, start + batch - 1)
          if (error || !data || data.length === 0) break
          all = all.concat(data as FlowRow[])
          if (data.length < batch) break
          start += batch
        }
      } catch {
        /* sin env / sin datos */
      } finally {
        if (!cancel) {
          setFlows(all)
          setLoadingFlows(false)
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [supabase, symbolsKey])

  const instrumentMap = useMemo(() => {
    const m = new Map<string, InstrumentLite>()
    instruments.forEach((i) => m.set(i.symbol, i))
    return m
  }, [instruments])

  const holdingMap = useMemo(() => {
    const m = new Map<string, number>()
    holdings.forEach((h) => m.set(h.symbol, h.vn))
    return m
  }, [holdings])

  const available = useMemo(
    () => instruments.filter((i) => !holdingMap.has(i.symbol)),
    [instruments, holdingMap],
  )

  // Estado de cada símbolo: cuántos flujos tiene y cuántos a futuro (para avisar
  // por qué un bono no valúa: sin flujos cargados o sin pagos futuros).
  const flowStatus = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const m = new Map<string, { total: number; futuros: number }>()
    for (const f of flows) {
      const s = m.get(f.symbol) ?? { total: 0, futuros: 0 }
      s.total += 1
      if (f.fecha_pago >= today) s.futuros += 1
      m.set(f.symbol, s)
    }
    return m
  }, [flows])

  // ── Flujo consolidado por moneda (+ jurisdicción en USD) y período ──
  const blocks = useMemo<FlowBlock[]>(() => {
    const today = new Date().toISOString().slice(0, 10)
    type Acc = { currency: string; jurisdiccion: string | null; rows: Map<string, Row> }
    const byBlock = new Map<string, Acc>()

    for (const f of flows) {
      const vn = holdingMap.get(f.symbol)
      if (!vn || !f.fecha_pago) continue
      if (soloFuturos && f.fecha_pago < today) continue
      const scale = vn / 100
      const instr = instrumentMap.get(f.symbol)
      const cur = normCurrency(f.moneda_pago ?? instr?.moneda_pago)
      // jurisdicción solo aplica en USD; en pesos siempre es Argentina
      const juris = esPesos(cur) ? null : instr?.jurisdiccion_pago?.trim() || null
      const blockId = juris ? `${cur}||${juris}` : cur

      let acc = byBlock.get(blockId)
      if (!acc) {
        acc = { currency: cur, jurisdiccion: juris, rows: new Map() }
        byBlock.set(blockId, acc)
      }
      const { key, label } = periodKey(f.fecha_pago, period)
      let row = acc.rows.get(key)
      if (!row) {
        row = { key, label, interes: 0, amortizacion: 0, total: 0 }
        acc.rows.set(key, row)
      }
      row.interes += (f.interes ?? 0) * scale
      row.amortizacion += (f.amortizacion ?? 0) * scale
      row.total += (f.total ?? 0) * scale
    }

    return Array.from(byBlock.entries())
      .map(([id, acc]) => {
        const rows = Array.from(acc.rows.values()).sort((a, b) => a.key.localeCompare(b.key))
        const totals = rows.reduce<Agg>(
          (a, r) => ({
            interes: a.interes + r.interes,
            amortizacion: a.amortizacion + r.amortizacion,
            total: a.total + r.total,
          }),
          { interes: 0, amortizacion: 0, total: 0 },
        )
        const label = acc.jurisdiccion ? `${acc.currency} · ${acc.jurisdiccion}` : acc.currency
        return { id, currency: acc.currency, jurisdiccion: acc.jurisdiccion, label, rows, totals, pagos: rows.length }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [flows, holdingMap, instrumentMap, period, soloFuturos])

  const addHolding = (symbol: string) => {
    setHoldings((prev) => (prev.some((h) => h.symbol === symbol) ? prev : [...prev, { symbol, vn: 100000 }]))
    setPickerOpen(false)
  }
  const removeHolding = (symbol: string) =>
    setHoldings((prev) => prev.filter((h) => h.symbol !== symbol))
  const setVn = (symbol: string, vn: number) =>
    setHoldings((prev) => prev.map((h) => (h.symbol === symbol ? { ...h, vn } : h)))

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Cartera</h1>
              <p className="text-muted-foreground">
                Armá una cartera de bonos por valor nominal y mirá el flujo de pagos consolidado por moneda
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* ── Constructor de cartera ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Instrumentos</CardTitle>
              <CardDescription>
                {holdings.length} {holdings.length === 1 ? "bono" : "bonos"} · valor nominal (VN)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" disabled={loadingInstr}>
                    {loadingInstr ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Agregar bono
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[360px]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por ticker o emisor..." />
                    <CommandList>
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        {available.map((i) => (
                          <CommandItem
                            key={i.symbol}
                            value={`${i.symbol} ${i.emisor ?? ""}`}
                            onSelect={() => addHolding(i.symbol)}
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="font-medium">{i.symbol}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                {typeLabel(i.instrument_type)}
                                {i.moneda_pago ? ` · ${normCurrency(i.moneda_pago)}` : ""}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {holdings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Todavía no agregaste bonos. Empezá con &ldquo;Agregar bono&rdquo;.
                </p>
              ) : (
                <div className="space-y-2">
                  {holdings.map((h) => {
                    const i = instrumentMap.get(h.symbol)
                    const st = flowStatus.get(h.symbol)
                    const sinFlujos = !loadingFlows && (!st || st.total === 0)
                    const sinFuturos = !loadingFlows && !sinFlujos && soloFuturos && st!.futuros === 0
                    return (
                      <div key={h.symbol} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{h.symbol}</span>
                              {i && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {typeLabel(i.instrument_type)}
                                </Badge>
                              )}
                              {i?.moneda_pago && (
                                <Badge variant="outline" className="text-[10px]">
                                  {normCurrency(i.moneda_pago)}
                                </Badge>
                              )}
                            </div>
                            {i?.emisor && (
                              <p className="text-xs text-muted-foreground truncate">{i.emisor}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeHolding(h.symbol)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground w-8">VN</label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={Number.isFinite(h.vn) ? h.vn : 0}
                            onChange={(e) => setVn(h.symbol, Number(e.target.value))}
                            className="h-8 font-mono text-right"
                          />
                        </div>
                        {sinFlujos && (
                          <p className="flex items-center gap-1 text-[11px] text-destructive">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> Sin flujos cargados — no valúa
                          </p>
                        )}
                        {sinFuturos && (
                          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> Sin pagos futuros (¿vencido?)
                          </p>
                        )}
                      </div>
                    )
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-destructive"
                    onClick={() => setHoldings([])}
                  >
                    Vaciar cartera
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Flujo consolidado ── */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Flujo de pagos</CardTitle>
                  <CardDescription>Consolidado de la cartera, separado por moneda de pago</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={soloFuturos ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSoloFuturos((v) => !v)}
                  >
                    {soloFuturos && <Check className="h-4 w-4" />}
                    Solo futuros
                  </Button>
                  <ToggleGroup
                    type="single"
                    value={period}
                    onValueChange={(v) => v && setPeriod(v as Period)}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="fecha">Fecha</ToggleGroupItem>
                    <ToggleGroupItem value="mes">Mes</ToggleGroupItem>
                    <ToggleGroupItem value="anio">Año</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFlows ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculando flujo...
                </div>
              ) : blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">
                  {holdings.length === 0
                    ? "Agregá bonos a la cartera para ver el flujo de pagos."
                    : "No hay flujos para mostrar con la configuración actual."}
                </p>
              ) : (
                <Tabs defaultValue={blocks[0].id}>
                  <TabsList>
                    {blocks.map((b) => (
                      <TabsTrigger key={b.id} value={b.id}>
                        {b.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {blocks.map((b) => (
                    <TabsContent key={b.id} value={b.id} className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Summary label="Interés" value={b.totals.interes} cur={b.currency} />
                        <Summary label="Amortización" value={b.totals.amortizacion} cur={b.currency} />
                        <Summary label="Total a cobrar" value={b.totals.total} cur={b.currency} highlight />
                        <Summary label="Pagos" value={b.pagos} count />
                      </div>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{period === "anio" ? "Año" : period === "mes" ? "Mes" : "Fecha"}</TableHead>
                              <TableHead className="text-right">Interés</TableHead>
                              <TableHead className="text-right">Amortización</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {b.rows.map((r) => (
                              <TableRow key={r.key}>
                                <TableCell className="font-medium">{r.label}</TableCell>
                                <TableCell className="text-right font-mono">{nf.format(r.interes)}</TableCell>
                                <TableCell className="text-right font-mono">{nf.format(r.amortizacion)}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                  {nf.format(r.total)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Summary({
  label,
  value,
  cur,
  count,
  highlight,
}: {
  label: string
  value: number
  cur?: string
  count?: boolean
  highlight?: boolean
}) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? "bg-primary/5 border-primary/30" : "bg-muted/30"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold font-mono ${highlight ? "text-primary" : "text-foreground"}`}>
        {count ? nf0.format(value) : nf.format(value)}
        {!count && cur ? <span className="text-xs font-sans text-muted-foreground ml-1">{cur}</span> : null}
      </p>
    </div>
  )
}
