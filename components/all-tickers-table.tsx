"use client"

import { useState, useEffect, useMemo } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Search, Filter } from "lucide-react"
import type { ReactNode } from "react"

type PriceLite = {
  last: number | null
  price_ars: number | null
  price_usd: number | null
  ytm: number | null
  duration_y: number | null
  change_pct: number | null
  tna: number | null
}

type Row = {
  symbol: string
  tipo_activo: string | null
  referencias: string | null
  moneda_pago: string | null
  vencimiento: string | null
  vr_vigente: number | null
  callable: boolean | null
  legislacion: string | null
  jurisdiccion_pago: string | null
  price?: PriceLite | null
  [k: string]: any
}

export function AllTickersTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [refFilter, setRefFilter] = useState<string>("all")
  const [monedaFilter, setMonedaFilter] = useState<string>("all")
  const [selected, setSelected] = useState<Row | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    ;(async () => {
      try {
        const [instrRes, pricesRes] = await Promise.all([
          supabase.from("instruments_v2").select("*").eq("is_active", true).order("symbol"),
          supabase.from("prices").select("symbol, last, price_ars, price_usd, ytm, duration_y, change_pct, tna"),
        ])
        if (instrRes.error) throw instrRes.error
        const priceMap = new Map<string, PriceLite>(
          (pricesRes.data || []).map((p: any) => [p.symbol, p]),
        )
        const merged = (instrRes.data || []).map((i: any) => ({ ...i, price: priceMap.get(i.symbol) ?? null })) as Row[]
        setRows(merged)
      } catch (e) {
        console.error("Error fetching tickers:", e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const tipos = useMemo(
    () => [...new Set(rows.map((r) => r.tipo_activo).filter(Boolean) as string[])].sort(),
    [rows],
  )
  const referencias = useMemo(
    () => [...new Set(rows.map((r) => r.referencias).filter(Boolean) as string[])].sort(),
    [rows],
  )
  const monedas = useMemo(
    () => [...new Set(rows.map((r) => r.moneda_pago).filter(Boolean) as string[])].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.symbol?.toLowerCase().includes(q) ||
        r.tipo_activo?.toLowerCase().includes(q) ||
        r.referencias?.toLowerCase().includes(q) ||
        r.legislacion?.toLowerCase().includes(q)
      const matchesType = typeFilter === "all" || r.tipo_activo === typeFilter
      const matchesRef = refFilter === "all" || r.referencias === refFilter
      const matchesMoneda = monedaFilter === "all" || r.moneda_pago === monedaFilter
      return matchesSearch && matchesType && matchesRef && matchesMoneda
    })
  }, [rows, searchTerm, typeFilter, refFilter, monedaFilter])

  const formatCurrency = (value: number | null) =>
    value == null
      ? "-"
      : new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)

  const formatDate = (dateString: string | null) =>
    !dateString ? "-" : new Date(dateString).toLocaleDateString("es-AR")

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Todos los Tickers</CardTitle>
          <CardDescription>Cargando instrumentos...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Todos los Tickers
        </CardTitle>
        <CardDescription>Vista consolidada de todos los instrumentos</CardDescription>

        <div className="flex flex-wrap gap-4 mt-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por ticker, tipo, referencia o legislación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={refFilter} onValueChange={setRefFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por referencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las referencias</SelectItem>
              {referencias.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monedaFilter} onValueChange={setMonedaFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar por moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las monedas</SelectItem>
              {monedas.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="text-center">Ticker</TableHead>
                <TableHead className="text-center">Tipo de Activo</TableHead>
                <TableHead className="text-center">Referencia</TableHead>
                <TableHead className="text-center">Moneda de pago</TableHead>
                <TableHead className="text-center">Vencimiento</TableHead>
                <TableHead className="text-center">Monto Residual</TableHead>
                <TableHead className="text-center">Callable</TableHead>
                <TableHead className="text-center">Legislación</TableHead>
                <TableHead className="text-center">Jurisdicción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No se encontraron instrumentos
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow
                    key={r.symbol}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="text-center font-medium">{r.symbol}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{r.tipo_activo || "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{r.referencias || "-"}</TableCell>
                    <TableCell className="text-center">{r.moneda_pago || "-"}</TableCell>
                    <TableCell className="text-center">{formatDate(r.vencimiento)}</TableCell>
                    <TableCell className="text-center">{formatCurrency(r.vr_vigente)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.callable ? "destructive" : "outline"}>
                        {r.callable ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{r.legislacion || "-"}</TableCell>
                    <TableCell className="text-center">{r.jurisdiccion_pago || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-muted-foreground text-center">
          Tocá una fila para ver el detalle • Mostrando {filtered.length} de {rows.length} instrumentos
        </div>

        <TickerDetailDialog row={selected} onClose={() => setSelected(null)} />
      </CardContent>
    </Card>
  )
}

// ── Modal de detalle ──
const fmtArs = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(v)
const fmtUsd = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v)
const fmtNum = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`)
const fmtDur = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(2)} años`)
const fmtDate = (s: string | null | undefined) =>
  !s ? "—" : new Date(s).toLocaleDateString("es-AR")

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  )
}
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  )
}

function TickerDetailDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const p = row?.price
  // precio a mostrar: ARS si paga en pesos, si no el último (USD)
  const esArs = (row?.moneda_pago || "").toUpperCase().includes("ARS")
  const precio = esArs ? p?.price_ars ?? p?.last : p?.last ?? p?.price_usd
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{row.symbol}</span>
                {row.tipo_activo && <span className="text-sm font-normal text-muted-foreground">{row.tipo_activo}</span>}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {row.emisor || ""}
                {row.referencias ? ` · ${row.referencias}` : ""}
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Precio" value={esArs ? fmtArs(precio) : fmtUsd(precio)} />
              <Metric label="TIR" value={fmtPct(p?.ytm)} />
              <Metric label="Duración" value={fmtDur(p?.duration_y)} />
              <Metric label="Var %" value={fmtPct(p?.change_pct)} />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Field label="Emisor" value={row.emisor} />
              <Field label="Tipo de activo" value={row.tipo_activo} />
              <Field label="Referencia" value={row.referencias} />
              <Field label="Moneda de pago" value={row.moneda_pago} />
              <Field label="ISIN" value={row.isin} />
              <Field label="Emisión" value={fmtDate(row.emision)} />
              <Field label="Vencimiento" value={fmtDate(row.vencimiento)} />
              <Field label="Legislación" value={row.legislacion} />
              <Field label="Jurisdicción pago" value={row.jurisdiccion_pago} />
              <Field label="Tipo de cupón" value={row.tipo_cupon} />
              <Field label="Lámina mínima" value={fmtNum(row.lamina_min)} />
              <Field label="Operación mínima" value={fmtNum(row.operacion_min)} />
              <Field label="Callable" value={row.callable == null ? "—" : row.callable ? "Sí" : "No"} />
              <Field label="Monto residual" value={fmtNum(row.vr_vigente)} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
