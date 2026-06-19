"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { LineChart, Search, ArrowUpDown, Plus, Trash2, X, Loader2 } from "lucide-react"

const STORAGE = "lb-equity-paneles-v1"

type Eq = {
  ticker: string
  tipo: string | null
  last: number | null
  closing_price: number | null
  var_diaria: number | null
  ts: string | null
}
type Panel = { id: string; name: string; tickers: string[] }

const nf = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (v: number | null | undefined) => (v == null ? "—" : nf.format(v))
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`)
const pctClass = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground"

export default function EquityPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Eq[]>([])
  const [loading, setLoading] = useState(true)
  const [panels, setPanels] = useState<Panel[]>([])
  const [hydrated, setHydrated] = useState(false)

  // localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE)
      if (raw) setPanels(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem(STORAGE, JSON.stringify(panels)) } catch {}
    }
  }, [panels, hydrated])

  // fetch + refresh cada 30s
  useEffect(() => {
    let cancel = false
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("acciones_cedears")
          .select("ticker, tipo, last, closing_price, var_diaria, ts")
          .order("ticker")
        if (!cancel && !error && data) setRows(data as Eq[])
      } catch {
        /* sin env */
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 30000)
    return () => { cancel = true; clearInterval(id) }
  }, [supabase])

  const cedears = useMemo(() => rows.filter((r) => r.tipo === "CEDEAR"), [rows])
  const acciones = useMemo(() => rows.filter((r) => r.tipo === "ACCION"), [rows])
  const byTicker = useMemo(() => new Map(rows.map((r) => [r.ticker, r])), [rows])

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <LineChart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Equity</h1>
              <p className="text-muted-foreground">Acciones argentinas y CEDEARs — precio y variación diaria (BYMA 24hs ARS)</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
          </div>
        ) : (
          <Tabs defaultValue="mercado">
            <TabsList>
              <TabsTrigger value="mercado">Mercado ({rows.length})</TabsTrigger>
              <TabsTrigger value="paneles">Mis paneles</TabsTrigger>
            </TabsList>
            <TabsContent value="mercado">
              <MarketTable rows={rows} nAcc={acciones.length} nCed={cedears.length} />
            </TabsContent>
            <TabsContent value="paneles">
              <PanelsView all={rows} byTicker={byTicker} panels={panels} setPanels={setPanels} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}

// ── Tabla de mercado combinada (acciones + cedears) ──
type SortKey = "ticker" | "tipo" | "last" | "closing_price" | "var_diaria"
function MarketTable({ rows, nAcc, nCed }: { rows: Eq[]; nAcc: number; nCed: number }) {
  const [q, setQ] = useState("")
  const [tipo, setTipo] = useState<"all" | "ACCION" | "CEDEAR">("all")
  const [sort, setSort] = useState<{ k: SortKey; dir: "asc" | "desc" }>({ k: "ticker", dir: "asc" })

  const data = useMemo(() => {
    const term = q.trim().toLowerCase()
    const f = rows.filter(
      (r) => (tipo === "all" || r.tipo === tipo) && (!term || r.ticker.toLowerCase().includes(term)),
    )
    const arr = [...f].sort((a, b) => {
      const va = a[sort.k] as string | number | null
      const vb = b[sort.k] as string | number | null
      if (typeof va === "number" || typeof vb === "number") return Number(va ?? -Infinity) - Number(vb ?? -Infinity)
      return String(va).localeCompare(String(vb))
    })
    return sort.dir === "desc" ? arr.reverse() : arr
  }, [rows, q, tipo, sort])

  const th = (k: SortKey, lbl: string, right = false) => (
    <TableHead
      className={`cursor-pointer select-none ${right ? "text-right" : "text-center"}`}
      onClick={() => setSort((s) => (s.k === k ? { k, dir: s.dir === "asc" ? "desc" : "asc" } : { k, dir: "asc" }))}
    >
      <span className={`inline-flex items-center gap-1 ${right ? "justify-end" : "justify-center"}`}>
        {lbl} <ArrowUpDown className={`h-3 w-3 ${sort.k === k ? "text-primary" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  )

  const chip = (v: "all" | "ACCION" | "CEDEAR", lbl: string) => (
    <button
      onClick={() => setTipo(v)}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        tipo === v ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {lbl}
    </button>
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar ticker..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-1.5">
            {chip("all", `Todos (${nAcc + nCed})`)}
            {chip("ACCION", `Acciones (${nAcc})`)}
            {chip("CEDEAR", `CEDEARs (${nCed})`)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto max-h-[72vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                {th("ticker", "Ticker")}
                {th("tipo", "Tipo")}
                {th("last", "Último", true)}
                {th("closing_price", "Cierre", true)}
                {th("var_diaria", "Var. día", true)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.ticker}>
                  <TableCell className="text-center font-medium">{r.ticker}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{r.tipo}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmtNum(r.last)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{fmtNum(r.closing_price)}</TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${pctClass(r.var_diaria)}`}>
                    {fmtPct(r.var_diaria)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Paneles de favoritos ──
function PanelsView({
  all,
  byTicker,
  panels,
  setPanels,
}: {
  all: Eq[]
  byTicker: Map<string, Eq>
  panels: Panel[]
  setPanels: React.Dispatch<React.SetStateAction<Panel[]>>
}) {
  const [activeId, setActiveId] = useState<string | null>(panels[0]?.id ?? null)
  const active = panels.find((p) => p.id === activeId) ?? panels[0] ?? null
  const [pickerOpen, setPickerOpen] = useState(false)

  const nuevoPanel = () => {
    const id = `${Date.now()}`
    const name = `Panel ${panels.length + 1}`
    setPanels((p) => [...p, { id, name, tickers: [] }])
    setActiveId(id)
  }
  const borrarPanel = (id: string) => {
    setPanels((p) => p.filter((x) => x.id !== id))
    if (activeId === id) setActiveId(panels.find((x) => x.id !== id)?.id ?? null)
  }
  const renombrar = (id: string, name: string) =>
    setPanels((p) => p.map((x) => (x.id === id ? { ...x, name } : x)))
  const addTicker = (t: string) =>
    setPanels((p) => p.map((x) => (x.id === active!.id && !x.tickers.includes(t) ? { ...x, tickers: [...x.tickers, t] } : x)))
  const removeTicker = (t: string) =>
    setPanels((p) => p.map((x) => (x.id === active!.id ? { ...x, tickers: x.tickers.filter((y) => y !== t) } : x)))

  const disponibles = active ? all.filter((r) => !active.tickers.includes(r.ticker)) : []

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Mis paneles</CardTitle>
        <CardDescription>Armá paneles con los CEDEARs y acciones que quieras seguir</CardDescription>
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {panels.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active?.id === p.id ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.name} ({p.tickers.length})
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={nuevoPanel} className="h-7 gap-1">
            <Plus className="h-3.5 w-3.5" /> Nuevo panel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!active ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Creá un panel para empezar a armar tu lista de seguimiento.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={active.name}
                onChange={(e) => renombrar(active.id, e.target.value)}
                className="h-8 w-44"
              />
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Plus className="h-4 w-4" /> Agregar ticker
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-72" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar acción o CEDEAR..." />
                    <CommandList>
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        {disponibles.map((r) => (
                          <CommandItem key={r.ticker} value={r.ticker} onSelect={() => { addTicker(r.ticker); setPickerOpen(false) }}>
                            <span className="font-medium">{r.ticker}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{r.tipo}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground hover:text-destructive ml-auto"
                onClick={() => borrarPanel(active.id)}>
                <Trash2 className="h-4 w-4" /> Borrar panel
              </Button>
            </div>

            {active.tickers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Panel vacío. Agregá tickers con &ldquo;Agregar ticker&rdquo;.
              </p>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Ticker</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-right">Último</TableHead>
                      <TableHead className="text-right">Var. día</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.tickers.map((t) => {
                      const r = byTicker.get(t)
                      return (
                        <TableRow key={t}>
                          <TableCell className="text-center font-medium">{t}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{r?.tipo ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{fmtNum(r?.last)}</TableCell>
                          <TableCell className={`text-right font-mono tabular-nums ${pctClass(r?.var_diaria)}`}>
                            {fmtPct(r?.var_diaria)}
                          </TableCell>
                          <TableCell className="text-center">
                            <button onClick={() => removeTicker(t)} className="text-muted-foreground hover:text-destructive">
                              <X className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
