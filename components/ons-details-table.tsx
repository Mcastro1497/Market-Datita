"use client"

import { useState, useMemo, Fragment, type ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import type { ONWithDetails } from "@/lib/types"
import { ArrowUpDown, Search, Users, CalendarDays, List, ChevronRight, ChevronDown } from "lucide-react"

type GroupBy = "none" | "emisor" | "year"

interface ONDetailsTableProps {
  flows: ONWithDetails[]
}

// === FIX FECHAS: tratar "YYYY-MM-DD" como fecha LOCAL (evita -1 día por TZ)
function parseLocalISODate(dateString?: string | null) {
  if (!dateString) return null
  const s = String(dateString)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    const [, y, mo, d] = m
    return new Date(Number(y), Number(mo) - 1, Number(d))
  }
  const d2 = new Date(s)
  return Number.isNaN(d2.getTime()) ? null : d2
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value)
}
const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("es-AR", { style: "decimal", maximumFractionDigits: 0, useGrouping: true }).format(value)
}
const formatDate = (dateString: string | null | undefined) => {
  const d = parseLocalISODate(dateString)
  return d ? new Intl.DateTimeFormat("es-AR").format(d) : "—"
}
const formatPercentage = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return `${(value * 100).toFixed(2)}%`
}
const formatDuration = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return `${value.toFixed(2)} años`
}

const COL_COUNT = 9

export function ONDetailsTable({ flows }: ONDetailsTableProps) {
  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [selected, setSelected] = useState<ONWithDetails | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>("none")
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const filteredAndSortedFlows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const filtered = flows.filter((flow) => {
      return (
        !q ||
        flow.ticker.toLowerCase().includes(q) ||
        flow.emisor.toLowerCase().includes(q) ||
        (flow.details?.ticker_usd || "").toLowerCase().includes(q)
      )
    })

    if (sortField) {
      filtered.sort((a, b) => {
        if (sortField === "details.vencimiento") {
          const da = parseLocalISODate(a.details?.vencimiento)?.getTime() ?? -Infinity
          const db = parseLocalISODate(b.details?.vencimiento)?.getTime() ?? -Infinity
          return sortDirection === "asc" ? da - db : db - da
        }

        let aValue: any = (a as any)[sortField as keyof ONWithDetails]
        let bValue: any = (b as any)[sortField as keyof ONWithDetails]

        if (sortField.includes("details.")) {
          const f = sortField.replace("details.", "")
          aValue = (a.details as any)?.[f]
          bValue = (b.details as any)?.[f]
        }
        if (sortField.includes("lastPrice.")) {
          const f = sortField.replace("lastPrice.", "")
          aValue = (a.lastPrice as any)?.[f]
          bValue = (b.lastPrice as any)?.[f]
        }

        if (aValue == null && bValue == null) return 0
        if (aValue == null) return 1
        if (bValue == null) return -1

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
        }
        return sortDirection === "asc" ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number)
      })
    }
    return filtered
  }, [flows, searchTerm, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortHead = ({ field, label, className = "" }: { field: string; label: string; className?: string }) => (
    <TableHead className={`text-center ${className}`}>
      <Button variant="ghost" onClick={() => handleSort(field)} className="h-auto p-0 font-semibold">
        {label} <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    </TableHead>
  )

  const renderRow = (flow: ONWithDetails) => {
    const chg = flow.lastPrice?.change
    return (
      <TableRow key={flow.id} onClick={() => setSelected(flow)} className="cursor-pointer hover:bg-muted/50">
        <TableCell className="text-left">{flow.emisor || "—"}</TableCell>
        <TableCell className="text-left font-medium">{flow.ticker}</TableCell>
        <TableCell className="text-center tabular-nums">{formatCurrency(flow.lastPrice?.last)}</TableCell>
        <TableCell className="text-center tabular-nums">
          <span className={chg && chg > 0 ? "text-green-600" : chg && chg < 0 ? "text-red-600" : "text-muted-foreground"}>
            {formatPercentage(chg)}
          </span>
        </TableCell>
        <TableCell className="text-center tabular-nums">{formatPercentage(flow.lastPrice?.ytm)}</TableCell>
        <TableCell className="text-center tabular-nums">{formatDuration(flow.lastPrice?.duration_y)}</TableCell>
        <TableCell className="text-center">{formatDate(flow.details?.vencimiento)}</TableCell>
        <TableCell className="text-center">{flow.details?.legislacion || "—"}</TableCell>
        <TableCell className="text-center">{flow.details?.jurisdiccion_pago || "—"}</TableCell>
      </TableRow>
    )
  }

  const groups = useMemo(() => {
    if (groupBy === "none") return []
    const map = new Map<string, ONWithDetails[]>()
    for (const flow of filteredAndSortedFlows) {
      let key: string
      if (groupBy === "emisor") {
        key = flow.emisor || "Sin emisor"
      } else {
        const d = parseLocalISODate(flow.details?.vencimiento)
        key = d ? String(d.getFullYear()) : "Sin vencimiento"
      }
      const arr = map.get(key)
      if (arr) arr.push(flow)
      else map.set(key, [flow])
    }
    const entries = [...map.entries()]
    entries.sort((a, b) => {
      if (groupBy === "year") {
        const na = Number(a[0])
        const nb = Number(b[0])
        if (Number.isNaN(na)) return 1
        if (Number.isNaN(nb)) return -1
        return na - nb
      }
      return a[0].localeCompare(b[0])
    })
    return entries.map(([key, rows]) => ({ key, rows }))
  }, [filteredAndSortedFlows, groupBy])

  return (
    <div className="space-y-4">
      {/* Búsqueda + agrupar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por ticker, emisor o ticker USD..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <span className="text-sm text-muted-foreground ml-auto">Agrupar:</span>
        <Button size="sm" variant={groupBy === "emisor" ? "default" : "outline"} onClick={() => setGroupBy("emisor")}>
          <Users className="h-4 w-4 mr-1.5" />Por emisor
        </Button>
        <Button size="sm" variant={groupBy === "year" ? "default" : "outline"} onClick={() => setGroupBy("year")}>
          <CalendarDays className="h-4 w-4 mr-1.5" />Por año de vto.
        </Button>
        <Button size="sm" variant={groupBy === "none" ? "default" : "outline"} onClick={() => setGroupBy("none")}>
          <List className="h-4 w-4 mr-1.5" />Desagrupar
        </Button>
      </div>

      {/* Tabla slim */}
      <div className="rounded-md border overflow-auto max-h-[72vh]" style={{ scrollbarWidth: "thin" }}>
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              <SortHead field="emisor" label="Emisor" className="text-left" />
              <SortHead field="ticker" label="Ticker" className="text-left" />
              <SortHead field="lastPrice.last" label="Precio USD" />
              <SortHead field="lastPrice.change" label="Var %" />
              <SortHead field="lastPrice.ytm" label="YTM" />
              <SortHead field="lastPrice.duration_y" label="Duración" />
              <SortHead field="details.vencimiento" label="Vto." />
              <SortHead field="details.legislacion" label="Legislación" />
              <SortHead field="details.jurisdiccion_pago" label="Jurisdicción Pago" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupBy === "none"
              ? filteredAndSortedFlows.map(renderRow)
              : groups.map((g) => {
                  const isOpen = openGroups.has(g.key)
                  return (
                    <Fragment key={g.key}>
                      <TableRow className="cursor-pointer bg-muted/60 hover:bg-muted" onClick={() => toggleGroup(g.key)}>
                        <TableCell colSpan={COL_COUNT} className="font-semibold">
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span>{g.key}</span>
                            <Badge variant="secondary">{g.rows.length}</Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen && g.rows.map(renderRow)}
                    </Fragment>
                  )
                })}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Tocá una fila para ver el detalle • {filteredAndSortedFlows.length} de {flows.length} ONs
        {groupBy !== "none" ? ` · ${groups.length} grupos` : ""}
      </div>

      {/* Modal de detalle */}
      <ONDetailDialog flow={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ── Carta de detalle ──────────────────────────────────────
function ONDetailDialog({ flow, onClose }: { flow: ONWithDetails | null; onClose: () => void }) {
  const d = flow?.details
  return (
    <Dialog open={!!flow} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {flow && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{flow.ticker}</span>
                {d?.ticker_usd && <span className="text-sm font-normal text-muted-foreground">/ {d.ticker_usd}</span>}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {flow.emisor}
                {d?.denominacion ? ` · ${d.denominacion}` : ""}
              </p>
            </DialogHeader>

            {/* Métricas de mercado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Precio USD" value={formatCurrency(flow.lastPrice?.last)} />
              <Metric label="YTM" value={formatPercentage(flow.lastPrice?.ytm)} />
              <Metric label="Duración" value={formatDuration(flow.lastPrice?.duration_y)} />
              <Metric label="Var %" value={formatPercentage(flow.lastPrice?.change)} />
            </div>

            <Separator />

            {/* Detalle del instrumento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Field label="ISIN" value={d?.isin} />
              <Field label="Moneda de pago" value={d?.moneda_pago} />
              <Field label="Emisión" value={formatDate(d?.emision)} />
              <Field label="Vencimiento" value={formatDate(d?.vencimiento)} />
              <Field label="Legislación" value={d?.legislacion} />
              <Field label="Jurisdicción pago" value={d?.jurisdiccion_pago} />
              <Field label="Tipo de cupón" value={d?.tipo_cupon} />
              <Field label="Tasa interés" value={formatPercentage(d?.tasa_int)} />
              <Field label="Convención int." value={d?.convencion_int} />
              <Field label="Periodicidad int." value={d?.periodicidad_int} />
              <Field label="Lámina mínima" value={formatAmount(d?.lamina_min)} />
              <Field label="Operación mínima" value={formatAmount(d?.operacion_min)} />
              <Field label="VN vigente" value={formatAmount(d?.vn_vigente)} />
              <Field label="VR vigente" value={formatAmount(d?.vr_vigente)} />
              <Field label="Valor residual" value={formatAmount(d?.valor_residual)} />
              <Field
                label="Callable"
                value={
                  d?.callable === null || d?.callable === undefined ? (
                    "—"
                  ) : (
                    <Badge variant={d.callable ? "default" : "secondary"}>{d.callable ? "Sí" : "No"}</Badge>
                  )
                }
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  )
}
