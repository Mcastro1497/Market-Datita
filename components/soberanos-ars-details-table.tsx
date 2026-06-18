"use client"

import { useState, useMemo, type ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import type { SoberanoWithDetails } from "@/lib/types"
import { ArrowUpDown, Search } from "lucide-react"

interface SoberanosArsDetailsTableProps {
  flows: SoberanoWithDetails[]
  activeTab: string
}

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

const formatArs = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(value)
}
const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("es-AR", { style: "decimal", maximumFractionDigits: 0, useGrouping: true }).format(value)
}
const formatDecimal = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("es-AR", { style: "decimal", maximumFractionDigits: 4 }).format(value)
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

export function SoberanosArsDetailsTable({ flows, activeTab }: SoberanosArsDetailsTableProps) {
  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [selected, setSelected] = useState<SoberanoWithDetails | null>(null)

  const isFija = activeTab === "FIJA"

  const filteredAndSortedFlows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const filtered = flows.filter((flow) => {
      return !q || flow.ticker.toLowerCase().includes(q) || flow.emisor.toLowerCase().includes(q)
    })

    if (sortField) {
      filtered.sort((a, b) => {
        if (sortField === "details.vencimiento") {
          const da = parseLocalISODate(a.details?.vencimiento)?.getTime() ?? -Infinity
          const db = parseLocalISODate(b.details?.vencimiento)?.getTime() ?? -Infinity
          return sortDirection === "asc" ? da - db : db - da
        }
        let aValue: any = (a as any)[sortField as keyof SoberanoWithDetails]
        let bValue: any = (b as any)[sortField as keyof SoberanoWithDetails]
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
    if (sortField === field) setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    else {
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

  return (
    <div className="space-y-4">
      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por ticker o emisor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabla slim */}
      <div className="rounded-md border overflow-auto max-h-[72vh]" style={{ scrollbarWidth: "thin" }}>
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              <SortHead field="ticker" label="Ticker" />
              <SortHead field="lastPrice.last" label="Precio ARS" />
              <SortHead field="lastPrice.change" label="Var %" />
              {isFija && <SortHead field="lastPrice.tna" label="TNA" />}
              <SortHead field="lastPrice.ytm" label="TIR" />
              <SortHead field="lastPrice.duration_y" label="Duración" />
              <SortHead field="details.vencimiento" label="Vto." />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedFlows.map((flow) => {
              const chg = flow.lastPrice?.change
              return (
                <TableRow
                  key={flow.id}
                  onClick={() => setSelected(flow)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="text-center font-medium">{flow.ticker}</TableCell>
                  <TableCell className="text-center tabular-nums">{formatArs(flow.lastPrice?.last)}</TableCell>
                  <TableCell className="text-center tabular-nums">
                    <span className={chg && chg > 0 ? "text-success" : chg && chg < 0 ? "text-destructive" : "text-muted-foreground"}>
                      {formatPercentage(chg)}
                    </span>
                  </TableCell>
                  {isFija && <TableCell className="text-center tabular-nums">{formatPercentage(flow.lastPrice?.tna)}</TableCell>}
                  <TableCell className="text-center tabular-nums">{formatPercentage(flow.lastPrice?.ytm)}</TableCell>
                  <TableCell className="text-center tabular-nums">{formatDuration(flow.lastPrice?.duration_y)}</TableCell>
                  <TableCell className="text-center">{formatDate(flow.details?.vencimiento)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Tocá una fila para ver el detalle • Mostrando {filteredAndSortedFlows.length} de {flows.length} bonos
      </div>

      <BondDetailDialog flow={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ── Carta de detalle ──────────────────────────────────────
function BondDetailDialog({ flow, onClose }: { flow: SoberanoWithDetails | null; onClose: () => void }) {
  const d = flow?.details
  const isTamar = d?.instrument_type === "TAMAR"
  const isCer = d?.instrument_type === "CER"
  return (
    <Dialog open={!!flow} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {flow && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{flow.ticker}</span>
                {d?.instrument_type && <span className="text-sm font-normal text-muted-foreground">{d.instrument_type}</span>}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {flow.emisor}
                {d?.denominacion ? ` · ${d.denominacion}` : ""}
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Precio ARS" value={formatArs(flow.lastPrice?.last)} />
              <Metric label="TIR" value={formatPercentage(flow.lastPrice?.ytm)} />
              <Metric label="Duración" value={formatDuration(flow.lastPrice?.duration_y)} />
              <Metric label="Var %" value={formatPercentage(flow.lastPrice?.change)} />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Field label="Emisor" value={flow.emisor} />
              <Field label="Referencias" value={d?.referencias} />
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
              {!isTamar && <Field label="CER emisión" value={formatDecimal(d?.cer_emision)} />}
              {isCer && <Field label="CER t-10" value={formatDecimal(d?.cer_t10)} />}
              {isCer && <Field label="Ratio (t-10 / emisión)" value={formatDecimal(d?.ratio_cer)} />}
              {isTamar && <Field label="Margen ref." value={formatPercentage(d?.margen_ref)} />}
              <Field label="Lámina mínima" value={formatAmount(d?.lamina_min)} />
              <Field label="Operación mínima" value={formatAmount(d?.operacion_min)} />
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

            {isTamar && (
              <>
                <Separator />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Métricas TAMAR</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <Field label="TAMAR observada" value={formatPercentage(flow.lastPrice?.tamar_obs)} />
                  <Field label="TAMAR proyectada" value={formatPercentage(flow.lastPrice?.tamar_proy)} />
                  <Field label="TEM observada" value={formatPercentage(flow.lastPrice?.tem_obs)} />
                  <Field label="TEM proyectada" value={formatPercentage(flow.lastPrice?.tem_proy)} />
                  <Field label="TEM ponderada" value={formatPercentage(flow.lastPrice?.tem_ponderada)} />
                  <Field label="TEM margen" value={formatPercentage(flow.lastPrice?.tem_margen)} />
                  <Field label="TEM total" value={formatPercentage(flow.lastPrice?.tem_total)} />
                </div>
              </>
            )}
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
