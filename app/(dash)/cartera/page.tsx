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
import { Plus, Trash2, Wallet, Loader2, Check, X, ArrowLeft } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

const PALETTE = ["#522398", "#8555ff", "#5632b2", "#73ffa1", "#b794f6", "#94a3b8", "#f59e0b", "#2a9d8f", "#e76f51", "#3b82f6"]

const STORAGE = "lb-carteras-v1"
const OLD_KEY = "lb-cartera-v1"

type Period = "fecha" | "mes" | "anio"
type Kind = "bond" | "equity"

type InstrumentLite = {
  symbol: string
  instrument_type: string
  emisor: string | null
  moneda_pago: string | null
  jurisdiccion_pago: string | null
  vencimiento: string | null
}
type PriceRow = {
  symbol: string
  last: number | null
  price_ars: number | null
  closing_price: number | null
  change_pct: number | null
  fx_mep: number | null
}
type Equity = { ticker: string; tipo: string | null; last: number | null; var_diaria: number | null }
type FlowRow = {
  symbol: string
  fecha_pago: string
  interes: number | null
  amortizacion: number | null
  total: number | null
  interes_proyectado: number | null
  amortizacion_proyectado: number | null
  total_proyectado: number | null
  moneda_pago: string | null
}
type Holding = { symbol: string; kind: Kind; qty: number }
type Portfolio = { id: string; name: string; holdings: Holding[] }

const TYPE_LABEL: Record<string, string> = { ON: "ON", HD: "Soberano HD", ARS: "Soberano ARS", DLK: "Dólar Linked" }
const typeLabel = (t: string | null | undefined) => (t && TYPE_LABEL[t]) || t || "Bono"

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const nf = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 })
const fmtArs = (v: number | null | undefined) => (v == null ? "—" : nf0.format(v))
const fmtUsd = (v: number | null | undefined) => (v == null ? "—" : nf.format(v))
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`)
const pctClass = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground"

const normCurrency = (c: string | null | undefined) => (c || "—").trim().toUpperCase()
const esPesos = (cur: string) => cur.includes("ARS") || cur.includes("PES") || cur === "$"

function periodKey(iso: string, period: Period): { key: string; label: string } {
  if (period === "anio") return { key: iso.slice(0, 4), label: iso.slice(0, 4) }
  if (period === "mes") {
    const y = iso.slice(0, 4), m = Number(iso.slice(5, 7))
    return { key: iso.slice(0, 7), label: `${MESES[m - 1] ?? "?"} ${y}` }
  }
  const [y, m, d] = iso.split("-")
  return { key: iso, label: `${d}/${m}/${y}` }
}

type Agg = { interes: number; amortizacion: number; total: number }
type Row = Agg & { key: string; label: string }
type FlowBlock = { id: string; currency: string; jurisdiccion: string | null; label: string; rows: Row[]; totals: Agg; pagos: number }

export default function CarteraPage() {
  const supabase = useMemo(() => createClient(), [])

  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [instruments, setInstruments] = useState<InstrumentLite[]>([])
  const [equities, setEquities] = useState<Equity[]>([])
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [flows, setFlows] = useState<FlowRow[]>([])
  const [period, setPeriod] = useState<Period>("mes")
  const [soloFuturos, setSoloFuturos] = useState(true)
  const [dolarizar, setDolarizar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const active = portfolios.find((p) => p.id === activeId) ?? portfolios[0] ?? null
  const holdings = active?.holdings ?? []

  // ── localStorage (con migración de la cartera vieja) ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE)
      if (raw) {
        const ps = JSON.parse(raw) as Portfolio[]
        setPortfolios(ps)
        setActiveId(ps[0]?.id ?? null)
      } else {
        const old = localStorage.getItem(OLD_KEY)
        const oldHoldings = old ? (JSON.parse(old) as { symbol: string; vn: number }[]) : []
        const id = "p1"
        setPortfolios([{ id, name: "Cartera 1", holdings: oldHoldings.map((h) => ({ symbol: h.symbol, kind: "bond" as Kind, qty: h.vn })) }])
        setActiveId(id)
      }
    } catch {}
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (hydrated) { try { localStorage.setItem(STORAGE, JSON.stringify(portfolios)) } catch {} }
  }, [portfolios, hydrated])

  // ── Data: instrumentos, equities, precios ──
  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const [insR, eqR, prR] = await Promise.all([
          supabase.from("instruments_v2")
            .select("symbol, instrument_type, emisor, moneda_pago, jurisdiccion_pago, vencimiento")
            .or("instrument_type.neq.FX,instrument_type.is.null").eq("is_active", true),
          supabase.from("acciones_cedears").select("ticker, tipo, last, var_diaria"),
          supabase.from("prices").select("symbol, last, price_ars, closing_price, change_pct, fx_mep"),
        ])
        if (!cancel) {
          if (insR.data) setInstruments((insR.data as InstrumentLite[]).slice().sort((a, b) => a.symbol.localeCompare(b.symbol)))
          if (eqR.data) setEquities((eqR.data as Equity[]).slice().sort((a, b) => a.ticker.localeCompare(b.ticker)))
          if (prR.data) setPrices(prR.data as PriceRow[])
        }
      } catch {} finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [supabase])

  const instrumentMap = useMemo(() => new Map(instruments.map((i) => [i.symbol, i])), [instruments])
  const equityMap = useMemo(() => new Map(equities.map((e) => [e.ticker, e])), [equities])
  const priceMap = useMemo(() => new Map(prices.map((p) => [p.symbol, p])), [prices])
  const mep = useMemo(() => {
    const al30 = priceMap.get("AL30")
    if (al30?.fx_mep) return al30.fx_mep
    for (const p of prices) if (p.fx_mep) return p.fx_mep
    return null
  }, [priceMap, prices])

  // ── Flujos de los bonos de la cartera activa ──
  const bondSymbolsKey = holdings.filter((h) => h.kind === "bond").map((h) => h.symbol).sort().join(",")
  useEffect(() => {
    const symbols = bondSymbolsKey ? bondSymbolsKey.split(",") : []
    if (symbols.length === 0) { setFlows([]); return }
    let cancel = false
    ;(async () => {
      let all: FlowRow[] = []
      try {
        let start = 0; const batch = 1000
        while (true) {
          const { data, error } = await supabase.from("instrument_flows_v3")
            .select("symbol, fecha_pago, interes, amortizacion, total, interes_proyectado, amortizacion_proyectado, total_proyectado, moneda_pago")
            .in("symbol", symbols).order("fecha_pago", { ascending: true }).range(start, start + batch - 1)
          if (error || !data || data.length === 0) break
          all = all.concat(data as FlowRow[])
          if (data.length < batch) break
          start += batch
        }
      } catch {} finally {
        if (!cancel) setFlows(all)
      }
    })()
    return () => { cancel = true }
  }, [supabase, bondSymbolsKey])

  // ── Valuación por tenencia ──
  type Val = { symbol: string; kind: Kind; nombre: string; tipo: string; qty: number; precioArs: number | null; valARS: number | null; valUSD: number | null; varPct: number | null }
  const valuations = useMemo<Val[]>(() => {
    return holdings.map((h) => {
      if (h.kind === "bond") {
        const i = instrumentMap.get(h.symbol)
        const p = priceMap.get(h.symbol)
        const arsPer100 = p?.price_ars ?? (p?.last != null && mep ? p.last * mep : null)
        const valARS = arsPer100 != null ? arsPer100 * (h.qty / 100) : null
        return { symbol: h.symbol, kind: h.kind, nombre: h.symbol, tipo: typeLabel(i?.instrument_type), qty: h.qty,
          precioArs: arsPer100, valARS, valUSD: valARS != null && mep ? valARS / mep : null, varPct: p?.change_pct ?? null }
      }
      const e = equityMap.get(h.symbol)
      const valARS = e?.last != null ? e.last * h.qty : null
      return { symbol: h.symbol, kind: h.kind, nombre: h.symbol, tipo: e?.tipo === "ACCION" ? "Acción" : "CEDEAR", qty: h.qty,
        precioArs: e?.last ?? null, valARS, valUSD: valARS != null && mep ? valARS / mep : null, varPct: e?.var_diaria ?? null }
    })
  }, [holdings, instrumentMap, priceMap, equityMap, mep])

  const totales = useMemo(() => {
    let ars = 0, usd = 0, ayer = 0
    for (const v of valuations) {
      if (v.valARS != null) { ars += v.valARS; ayer += v.valARS / (1 + (v.varPct ?? 0)) }
      if (v.valUSD != null) usd += v.valUSD
    }
    return { ars, usd, varDia: ayer > 0 ? ars / ayer - 1 : null }
  }, [valuations])

  // ── Flujo consolidado (bonos) ──
  const bondHoldingMap = useMemo(() => new Map(holdings.filter((h) => h.kind === "bond").map((h) => [h.symbol, h.qty])), [holdings])
  const blocks = useMemo<FlowBlock[]>(() => {
    const today = new Date().toISOString().slice(0, 10)
    type Acc = { currency: string; jurisdiccion: string | null; rows: Map<string, Row> }
    const byBlock = new Map<string, Acc>()
    for (const f of flows) {
      const vn = bondHoldingMap.get(f.symbol)
      if (!vn || !f.fecha_pago) continue
      if (soloFuturos && f.fecha_pago < today) continue
      const scale = vn / 100
      const instr = instrumentMap.get(f.symbol)
      const cur = normCurrency(f.moneda_pago ?? instr?.moneda_pago)
      const juris = esPesos(cur) ? null : instr?.jurisdiccion_pago?.trim() || null
      const blockId = juris ? `${cur}||${juris}` : cur
      let acc = byBlock.get(blockId)
      if (!acc) { acc = { currency: cur, jurisdiccion: juris, rows: new Map() }; byBlock.set(blockId, acc) }
      const { key, label } = periodKey(f.fecha_pago, period)
      let row = acc.rows.get(key)
      if (!row) { row = { key, label, interes: 0, amortizacion: 0, total: 0 }; acc.rows.set(key, row) }
      row.interes += (f.interes_proyectado ?? f.interes ?? 0) * scale
      row.amortizacion += (f.amortizacion_proyectado ?? f.amortizacion ?? 0) * scale
      row.total += (f.total_proyectado ?? f.total ?? 0) * scale
    }
    return Array.from(byBlock.values()).map((acc) => {
      const rows = Array.from(acc.rows.values()).sort((a, b) => a.key.localeCompare(b.key))
      const totals = rows.reduce<Agg>((a, r) => ({ interes: a.interes + r.interes, amortizacion: a.amortizacion + r.amortizacion, total: a.total + r.total }), { interes: 0, amortizacion: 0, total: 0 })
      const label = acc.jurisdiccion ? `${acc.currency} · ${acc.jurisdiccion}` : acc.currency
      return { id: label, currency: acc.currency, jurisdiccion: acc.jurisdiccion, label, rows, totals, pagos: rows.length }
    }).sort((a, b) => a.label.localeCompare(b.label))
  }, [flows, bondHoldingMap, instrumentMap, period, soloFuturos])

  // ── Mutaciones ──
  const updateActive = (fn: (p: Portfolio) => Portfolio) =>
    setPortfolios((ps) => ps.map((p) => (p.id === active?.id ? fn(p) : p)))
  const addHolding = (symbol: string, kind: Kind) => {
    updateActive((p) => (p.holdings.some((h) => h.symbol === symbol && h.kind === kind) ? p
      : { ...p, holdings: [...p.holdings, { symbol, kind, qty: kind === "bond" ? 100000 : 100 }] }))
    setPickerOpen(false)
  }
  const removeHolding = (symbol: string, kind: Kind) =>
    updateActive((p) => ({ ...p, holdings: p.holdings.filter((h) => !(h.symbol === symbol && h.kind === kind)) }))
  const setQty = (symbol: string, kind: Kind, qty: number) =>
    updateActive((p) => ({ ...p, holdings: p.holdings.map((h) => (h.symbol === symbol && h.kind === kind ? { ...h, qty } : h)) }))

  const nuevaCartera = () => {
    const id = `${Date.now()}`
    setPortfolios((ps) => [...ps, { id, name: `Cartera ${ps.length + 1}`, holdings: [] }])
    setActiveId(id)
  }
  const borrarCartera = (id: string) => {
    setPortfolios((ps) => ps.filter((p) => p.id !== id))
    if (activeId === id) setActiveId(portfolios.find((p) => p.id !== id)?.id ?? null)
  }
  const renombrar = (id: string, name: string) => setPortfolios((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)))

  const heldKeys = new Set(holdings.map((h) => `${h.kind}:${h.symbol}`))
  const bonosDisp = instruments.filter((i) => !heldKeys.has(`bond:${i.symbol}`))
  const eqDisp = equities.filter((e) => !heldKeys.has(`equity:${e.ticker}`))

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Wallet className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Carteras</h1>
              <p className="text-muted-foreground">Bonos, acciones y CEDEARs — valor hoy y variación del día en ARS y USD (MEP)</p>
            </div>
          </div>
          {/* selector de carteras */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            {portfolios.map((p) => (
              <button key={p.id} onClick={() => setActiveId(p.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active?.id === p.id ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:bg-muted"}`}>
                {p.name}
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={nuevaCartera} className="h-7 gap-1"><Plus className="h-3.5 w-3.5" /> Nueva</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...</div>
        ) : !active ? (
          <p className="text-center text-muted-foreground py-16">Creá una cartera para empezar.</p>
        ) : (
          <>
            {/* Totales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Valor (ARS)" value={`$ ${fmtArs(totales.ars)}`} highlight />
              <Metric label="Valor (USD)" value={`US$ ${fmtUsd(totales.usd)}`} highlight />
              <Metric label="Var. del día" value={fmtPct(totales.varDia)} cls={pctClass(totales.varDia)} />
              <Metric label="MEP (AL30/AL30D)" value={mep ? `$ ${nf.format(mep)}` : "—"} />
            </div>

            {/* Composición */}
            {valuations.some((v) => v.valARS != null) && (
              <Composicion vals={valuations} />
            )}

            {/* Tenencias */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Input value={active.name} onChange={(e) => renombrar(active.id, e.target.value)} className="h-8 w-40" />
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1"><Plus className="h-4 w-4" /> Agregar activo</Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-80" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar bono, acción o CEDEAR..." />
                          <CommandList>
                            <CommandEmpty>Sin resultados.</CommandEmpty>
                            <CommandGroup heading="Bonos">
                              {bonosDisp.map((i) => (
                                <CommandItem key={`b-${i.symbol}`} value={`${i.symbol} ${i.emisor ?? ""}`} onSelect={() => addHolding(i.symbol, "bond")}>
                                  <span className="font-medium">{i.symbol}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">{typeLabel(i.instrument_type)}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandGroup heading="Acciones / CEDEARs">
                              {eqDisp.map((e) => (
                                <CommandItem key={`e-${e.ticker}`} value={e.ticker} onSelect={() => addHolding(e.ticker, "equity")}>
                                  <span className="font-medium">{e.ticker}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">{e.tipo === "ACCION" ? "Acción" : "CEDEAR"}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground hover:text-destructive" onClick={() => borrarCartera(active.id)}>
                    <Trash2 className="h-4 w-4" /> Borrar cartera
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {holdings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Agregá bonos, acciones o CEDEARs con &ldquo;Agregar activo&rdquo;.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Activo</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Cantidad / VN</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Valor ARS</TableHead>
                          <TableHead className="text-right">Valor USD</TableHead>
                          <TableHead className="text-right">Peso</TableHead>
                          <TableHead className="text-right">Var. día</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {valuations.map((v) => (
                          <TableRow key={`${v.kind}:${v.symbol}`}>
                            <TableCell className="font-medium">{v.nombre}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{v.tipo}</TableCell>
                            <TableCell className="text-right">
                              <Input type="number" inputMode="numeric" min={0} value={Number.isFinite(v.qty) ? v.qty : 0}
                                onChange={(e) => setQty(v.symbol, v.kind, Number(e.target.value))}
                                className="h-7 w-28 font-mono text-right ml-auto" />
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{fmtArs(v.precioArs)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{fmtArs(v.valARS)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{fmtUsd(v.valUSD)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                              {totales.ars > 0 && v.valARS != null ? `${((v.valARS / totales.ars) * 100).toFixed(1)}%` : "—"}
                            </TableCell>
                            <TableCell className={`text-right font-mono tabular-nums ${pctClass(v.varPct)}`}>{fmtPct(v.varPct)}</TableCell>
                            <TableCell>
                              <button onClick={() => removeHolding(v.symbol, v.kind)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-semibold">
                          <TableCell colSpan={4}>Total</TableCell>
                          <TableCell className="text-right font-mono">$ {fmtArs(totales.ars)}</TableCell>
                          <TableCell className="text-right font-mono">US$ {fmtUsd(totales.usd)}</TableCell>
                          <TableCell className="text-right font-mono">100%</TableCell>
                          <TableCell className={`text-right font-mono ${pctClass(totales.varDia)}`}>{fmtPct(totales.varDia)}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Flujo de fondos (bonos) */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Flujo de fondos</CardTitle>
                    <CardDescription>Consolidado de los bonos de la cartera, separado por moneda</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant={soloFuturos ? "default" : "outline"} size="sm" onClick={() => setSoloFuturos((v) => !v)}>
                      {soloFuturos && <Check className="h-4 w-4" />} Solo futuros
                    </Button>
                    <Button variant={dolarizar ? "default" : "outline"} size="sm" onClick={() => setDolarizar((v) => !v)} disabled={!mep}>
                      {dolarizar && <Check className="h-4 w-4" />} Dolarizar (MEP)
                    </Button>
                    <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as Period)} variant="outline" size="sm">
                      <ToggleGroupItem value="fecha">Fecha</ToggleGroupItem>
                      <ToggleGroupItem value="mes">Mes</ToggleGroupItem>
                      <ToggleGroupItem value="anio">Año</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {blocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    {bondHoldingMap.size === 0 ? "Agregá bonos para ver el flujo de fondos." : "No hay flujos para mostrar con la configuración actual."}
                  </p>
                ) : (
                  <Tabs defaultValue={blocks[0].id}>
                    <TabsList>{blocks.map((b) => <TabsTrigger key={b.id} value={b.id}>{b.label}</TabsTrigger>)}</TabsList>
                    {blocks.map((b) => {
                      const sc = dolarizar && esPesos(b.currency) && mep ? 1 / mep : 1
                      const dcur = dolarizar && esPesos(b.currency) && mep ? "USD" : b.currency
                      return (
                      <TabsContent key={b.id} value={b.id} className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <Metric label="Interés" value={`${nf.format(b.totals.interes * sc)} ${dcur}`} />
                          <Metric label="Amortización" value={`${nf.format(b.totals.amortizacion * sc)} ${dcur}`} />
                          <Metric label="Total a cobrar" value={`${nf.format(b.totals.total * sc)} ${dcur}`} highlight />
                          <Metric label="Pagos" value={nf0.format(b.pagos)} />
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
                                  <TableCell className="text-right font-mono">{nf.format(r.interes * sc)}</TableCell>
                                  <TableCell className="text-right font-mono">{nf.format(r.amortizacion * sc)}</TableCell>
                                  <TableCell className="text-right font-mono font-semibold">{nf.format(r.total * sc)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    )})}
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function Composicion({ vals }: { vals: { tipo: string; symbol: string; valARS: number | null }[] }) {
  const [drill, setDrill] = useState<string | null>(null)

  const items = useMemo(() => {
    const m = new Map<string, number>()
    if (drill) {
      for (const v of vals) if (v.tipo === drill && v.valARS != null) m.set(v.symbol, (m.get(v.symbol) ?? 0) + v.valARS)
    } else {
      for (const v of vals) if (v.valARS != null) m.set(v.tipo, (m.get(v.tipo) ?? 0) + v.valARS)
    }
    const tot = [...m.values()].reduce((a, b) => a + b, 0)
    return { rows: [...m.entries()].map(([name, value]) => ({ name, value, pct: tot > 0 ? value / tot : 0 })).sort((a, b) => b.value - a.value), tot }
  }, [vals, drill])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Composición {drill ? <span className="text-muted-foreground font-normal text-base">· {drill}</span> : <span className="text-muted-foreground font-normal text-base">por tipo</span>}
          </CardTitle>
          {drill ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setDrill(null)}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Tocá una porción para ver el detalle</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <div className="h-[220px] w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items.rows}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={1}
                onClick={(d: any) => { if (!drill && d?.name) setDrill(d.name) }}
              >
                {items.rows.map((e, i) => (
                  <Cell key={e.name} fill={PALETTE[i % PALETTE.length]} cursor={drill ? "default" : "pointer"} stroke="var(--card)" />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, n: string) => [`$ ${nf0.format(v)} (${((v / items.tot) * 100).toFixed(1)}%)`, n]}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          </div>
          <div className="w-full space-y-1.5 sm:max-w-xs max-h-[220px] overflow-auto">
            {items.rows.map((r, i) => (
              <button
                key={r.name}
                onClick={() => { if (!drill) setDrill(r.name) }}
                className={`flex items-center gap-2 w-full text-sm ${drill ? "cursor-default" : "hover:bg-muted rounded px-1"}`}
              >
                <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="font-medium">{r.name}</span>
                <span className="ml-auto font-mono text-muted-foreground">$ {fmtArs(r.value)}</span>
                <span className="font-mono font-semibold w-14 text-right">{(r.pct * 100).toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, highlight, cls }: { label: string; value: string; highlight?: boolean; cls?: string }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? "bg-primary/5 border-primary/30" : "bg-muted/30"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold font-mono ${cls ?? (highlight ? "text-primary" : "text-foreground")}`}>{value}</p>
    </div>
  )
}
