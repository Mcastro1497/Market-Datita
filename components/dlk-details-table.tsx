"use client"

import { useState, useMemo, type ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import type { DlkWithDetails } from "@/lib/types"
import { ArrowUpDown, Search, Link2 } from "lucide-react"

interface DlkDetailsTableProps {
  flows: DlkWithDetails[]
  fxOficial: number | null
}

export function DlkDetailsTable({ flows, fxOficial }: DlkDetailsTableProps) {
  // Por defecto los bonos se listan por vencimiento ascendente: es el orden en
  // que se lee una curva, y deja arriba lo que vence primero.
  const [sortField, setSortField] = useState<string>("details.vencimiento")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [emisorFilter, setEmisorFilter] = useState<string>("")
  const [selected, setSelected] = useState<DlkWithDetails | null>(null)

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

  const uniqueEmisors = useMemo(() => {
    const emisors = [...new Set(flows.map((flow) => flow.emisor))]
    return emisors.sort()
  }, [flows])

  const filteredAndSortedFlows = useMemo(() => {
    const filtered = flows.filter((flow) => {
      const matchesSearch =
        !searchTerm ||
        flow.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        flow.emisor.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesEmisor = !emisorFilter || emisorFilter === "all" || flow.emisor === emisorFilter

      return matchesSearch && matchesEmisor
    })

    if (sortField) {
      filtered.sort((a, b) => {
        if (sortField === "details.vencimiento") {
          // Un bono sin vencimiento cargado no es "el que vence primero": va al final
          // en cualquier dirección, para no ensuciar la cabecera de la curva.
          const da = parseLocalISODate(a.details?.vencimiento)?.getTime() ?? null
          const db = parseLocalISODate(b.details?.vencimiento)?.getTime() ?? null
          if (da === null || db === null) return da === db ? 0 : da === null ? 1 : -1
          return sortDirection === "asc" ? da - db : db - da
        }

        let aValue: any = (a as any)[sortField as keyof DlkWithDetails]
        let bValue: any = (b as any)[sortField as keyof DlkWithDetails]

        if (sortField.includes("details.")) {
          const detailField = sortField.replace("details.", "")
          aValue = (a.details as any)?.[detailField]
          bValue = (b.details as any)?.[detailField]
        }

        if (sortField.includes("lastPrice.")) {
          const lastPriceField = sortField.replace("lastPrice.", "")
          aValue = (a.lastPrice as any)?.[lastPriceField]
          bValue = (b.lastPrice as any)?.[lastPriceField]
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
  }, [flows, searchTerm, emisorFilter, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Formato ARS: pesos argentinos
  const formatArs = (value: number | null) => {
    if (value === null || value === undefined) return ""
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(value)
  }

  // Formato USD equivalente (para mostrar precio en USD calculado)
  const formatUsd = (value: number | null) => {
    if (value === null || value === undefined) return ""
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value)
  }

  const formatAmount = (value: number | null) => {
    if (value === null || value === undefined) return ""
    return new Intl.NumberFormat("es-AR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }).format(value)
  }

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return ""
    return `${(value * 100).toFixed(2)}%`
  }

  const formatDuration = (value: number | null) => {
    if (value === null || value === undefined) return ""
    return `${value.toFixed(2)} años`
  }

  return (
    <div className="space-y-4">
      {/* Header con info del tipo Dólar Linked */}
      <div className="bg-lb-violet-accent/10 border border-lb-violet-accent/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-5 w-5 text-lb-violet-accent" />
          <h3 className="font-semibold text-lb-violet-accent">Bonos Dólar Linked</h3>
        </div>
        <p className="text-sm text-lb-violet-accent">
          Bonos en pesos ajustados por el tipo de cambio oficial. La TIR se calcula en USD dividiendo el precio en ARS
          por el FX oficial (A3500) que se obtiene de MAE.
        </p>
      </div>

      {/* Filtros básicos */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 h-4 w-4" />
          <Input
            placeholder="Buscar por ticker o emisor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={emisorFilter} onValueChange={setEmisorFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por emisor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los emisores</SelectItem>
            {uniqueEmisors.filter(Boolean).map((emisor) => (
              <SelectItem key={emisor} value={emisor}>
                {emisor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div
        className="rounded-md border overflow-auto max-h-[70vh] relative"
        onWheel={(e) => {
          if (e.shiftKey) {
            e.preventDefault()
            e.currentTarget.scrollLeft += e.deltaY
          }
        }}
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 #f1f5f9",
        }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              <TableHead className="text-left">
                <Button variant="ghost" onClick={() => handleSort("emisor")} className="h-auto p-0 font-semibold">
                  Emisor <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-left">
                <Button variant="ghost" onClick={() => handleSort("ticker")} className="h-auto p-0 font-semibold">
                  Ticker <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("lastPrice.last")}
                  className="h-auto p-0 font-semibold"
                >
                  Precio ARS <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("lastPrice.price_usd")}
                  className="h-auto p-0 font-semibold"
                >
                  Precio USD eq. <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("lastPrice.change")}
                  className="h-auto p-0 font-semibold"
                >
                  Var % <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("lastPrice.ytm")}
                  className="h-auto p-0 font-semibold"
                >
                  TIR USD <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("lastPrice.duration_y")}
                  className="h-auto p-0 font-semibold"
                >
                  Duración <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("details.vencimiento")}
                  className="h-auto p-0 font-semibold"
                >
                  Vencimiento <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center bg-background">Legislación</TableHead>
              <TableHead className="text-center bg-background">Jurisdicción Pago</TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" onClick={() => handleSort("cupon")} className="h-auto p-0 font-semibold">
                  Cupón <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("details.lamina_min")}
                  className="h-auto p-0 font-semibold"
                >
                  Lámina Mínima <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center bg-background">Calleable</TableHead>
              <TableHead className="text-center font-semibold">Monto Nominal Residual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedFlows.map((flow) => (
              <TableRow
                key={flow.id}
                onClick={() => setSelected(flow)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell className="text-center">{flow.emisor}</TableCell>
                <TableCell className="text-center font-medium">{flow.ticker}</TableCell>
                <TableCell className="text-center">{formatArs(flow.lastPrice?.price_ars ?? flow.lastPrice?.last ?? null)}</TableCell>
                <TableCell className="text-center font-medium text-lb-violet-accent">
                  {formatUsd(flow.lastPrice?.price_usd ?? null)}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={`${
                      flow.lastPrice?.change && flow.lastPrice.change > 0
                        ? "text-success"
                        : flow.lastPrice?.change && flow.lastPrice.change < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formatPercentage(flow.lastPrice?.change ?? null)}
                  </span>
                </TableCell>
                <TableCell className="text-center">{formatPercentage(flow.lastPrice?.ytm ?? null)}</TableCell>
                <TableCell className="text-center">{formatDuration(flow.lastPrice?.duration_y ?? null)}</TableCell>
                <TableCell className="text-center bg-muted/50">
                  {(() => {
                    const d = parseLocalISODate(flow.details?.vencimiento || null)
                    return d ? new Intl.DateTimeFormat("es-AR").format(d) : ""
                  })()}
                </TableCell>
                <TableCell className="text-center bg-muted/50">{flow.details?.legislacion || ""}</TableCell>
                <TableCell className="text-center bg-muted/50">{flow.details?.jurisdiccion_pago || ""}</TableCell>
                <TableCell className="text-center bg-muted/50">{formatPercentage(flow.cupon)}</TableCell>
                <TableCell className="text-center bg-muted/50">
                  {formatAmount(flow.details?.lamina_min ?? null)}
                </TableCell>
                <TableCell className="text-center bg-muted/50">
                  {flow.details?.callable !== undefined && flow.details?.callable !== null ? (
                    <Badge variant={flow.details.callable ? "default" : "secondary"}>
                      {flow.details.callable ? "Sí" : "No"}
                    </Badge>
                  ) : (
                    ""
                  )}
                </TableCell>
                <TableCell className="text-center bg-muted/50">
                  {formatAmount(flow.details?.vr_vigente ?? null)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Tocá una fila para ver el detalle • Mostrando {filteredAndSortedFlows.length} de {flows.length} bonos Dólar Linked
        {fxOficial && ` • FX oficial usado: $${fxOficial.toFixed(4)}`}
      </div>

      <DlkDetailDialog flow={selected} onClose={() => setSelected(null)} fxOficial={fxOficial} />
    </div>
  )
}

// ── Modal de detalle DLK ──
const dlkArs = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(v)
const dlkUsd = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v)
const dlkAmount = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v)
const dlkPct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`)
const dlkDur = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(2)} años`)
const dlkDate = (s: string | null | undefined) => {
  if (!s) return "—"
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(String(s))
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-AR").format(d)
}

function DlkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  )
}
function DlkField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  )
}

function DlkDetailDialog({
  flow,
  onClose,
  fxOficial,
}: {
  flow: DlkWithDetails | null
  onClose: () => void
  fxOficial: number | null
}) {
  const d = flow?.details
  return (
    <Dialog open={!!flow} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {flow && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-baseline gap-2">
                <span className="text-xl font-bold">{flow.ticker}</span>
                <span className="text-sm font-normal text-muted-foreground">Dólar Linked</span>
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {flow.emisor}
                {d?.denominacion ? ` · ${d.denominacion}` : ""}
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DlkMetric label="Precio ARS" value={dlkArs(flow.lastPrice?.price_ars ?? flow.lastPrice?.last)} />
              <DlkMetric label="Precio USD" value={dlkUsd(flow.lastPrice?.price_usd)} />
              <DlkMetric label="TIR (USD)" value={dlkPct(flow.lastPrice?.ytm)} />
              <DlkMetric label="Duración" value={dlkDur(flow.lastPrice?.duration_y)} />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <DlkField label="Emisor" value={flow.emisor} />
              <DlkField label="Referencias" value={d?.referencias} />
              <DlkField label="ISIN" value={d?.isin} />
              <DlkField label="Moneda de pago" value={d?.moneda_pago} />
              <DlkField label="Emisión" value={dlkDate(d?.emision)} />
              <DlkField label="Vencimiento" value={dlkDate(d?.vencimiento)} />
              <DlkField label="Legislación" value={d?.legislacion} />
              <DlkField label="Jurisdicción pago" value={d?.jurisdiccion_pago} />
              <DlkField label="Tipo de cupón" value={d?.tipo_cupon} />
              <DlkField label="Cupón" value={dlkPct(flow.cupon)} />
              <DlkField label="Convención int." value={d?.convencion_int} />
              <DlkField label="Periodicidad int." value={d?.periodicidad_int} />
              <DlkField label="Lámina mínima" value={dlkAmount(d?.lamina_min)} />
              <DlkField label="Operación mínima" value={dlkAmount(d?.operacion_min)} />
              <DlkField
                label="Callable"
                value={d?.callable == null ? "—" : d.callable ? "Sí" : "No"}
              />
              <DlkField label="Monto residual" value={dlkAmount(d?.vr_vigente)} />
              <DlkField label="Var %" value={dlkPct(flow.lastPrice?.change)} />
              <DlkField label="FX oficial (A3500)" value={fxOficial == null ? "—" : dlkArs(fxOficial)} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
