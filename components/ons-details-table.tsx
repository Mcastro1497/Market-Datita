"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { ONWithDetails } from "@/lib/types"
import { ArrowUpDown, Search } from "lucide-react"

interface ONDetailsTableProps {
  flows: ONWithDetails[]
}

export function ONDetailsTable({ flows }: ONDetailsTableProps) {
  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [emisorFilter, setEmisorFilter] = useState<string>("")

  // === FIX FECHAS: tratar "YYYY-MM-DD" como fecha local (evita -1 día)
  function parseLocalISODate(dateString?: string | null) {
    if (!dateString) return null
    const s = String(dateString)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/) // Supabase DATE
    if (m) {
      const [, y, mo, d] = m
      return new Date(Number(y), Number(mo) - 1, Number(d)) // local
    }
    const d = new Date(s) // timestamps con hora/Z
    return Number.isNaN(d.getTime()) ? null : d
  }

  // Obtener emisores únicos para el filtro
  const uniqueEmisors = useMemo(() => {
    const emisors = [...new Set(flows.map((flow) => flow.emisor))]
    return emisors.sort()
  }, [flows])

  // Filtrar y ordenar datos
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
        // === FIX ORDENAMIENTO POR VENCIMIENTO (usa parser local)
        if (sortField === "details.fecha_vencimiento") {
          const da = parseLocalISODate(a.details?.fecha_vencimiento)?.getTime() ?? -Infinity
          const db = parseLocalISODate(b.details?.fecha_vencimiento)?.getTime() ?? -Infinity
          return sortDirection === "asc" ? da - db : db - da
        }

        let aValue: any = (a as any)[sortField as keyof ONWithDetails]
        let bValue: any = (b as any)[sortField as keyof ONWithDetails]

        // Manejar campos de detalles
        if (sortField.includes("details.")) {
          const detailField = sortField.replace("details.", "")
          aValue = (a.details as any)?.[detailField]
          bValue = (b.details as any)?.[detailField]
        }

        // Manejar campos de lastPrice
        if (sortField.includes("lastPrice.")) {
          const lastPriceField = sortField.replace("lastPrice.", "")
          aValue = (a.lastPrice as any)?.[lastPriceField]
          bValue = (b.lastPrice as any)?.[lastPriceField]
        }

        if (aValue === null || aValue === undefined) aValue = ""
        if (bValue === null || bValue === undefined) bValue = ""

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

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return ""
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
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

  const formatDate = (dateString: string | null) => {
    const d = parseLocalISODate(dateString)
    if (!d) return ""
    return new Intl.DateTimeFormat("es-AR").format(d)
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
      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 #f1f5f9" }}
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
                  Precio USD <ArrowUpDown className="ml-2 h-4 w-4" />
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
                  YTM <ArrowUpDown className="ml-2 h-4 w-4" />
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
                  onClick={() => handleSort("details.fecha_vencimiento")}
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
                  onClick={() => handleSort("details.lamina_minima")}
                  className="h-auto p-0 font-semibold"
                >
                  Lámina Mínima <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center bg-background">Calleable</TableHead>
              <TableHead className="text-center bg-background">Monto Nominal Residual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedFlows.map((flow) => (
              <TableRow key={flow.id}>
                <TableCell className="text-left">{flow.emisor}</TableCell>
                <TableCell className="text-center font-medium">{flow.ticker}</TableCell>
                <TableCell className="text-center">{formatCurrency(flow.lastPrice?.last ?? null)}</TableCell>
                <TableCell className="text-center">
                  <span
                    className={`${
                      flow.lastPrice?.change && flow.lastPrice.change > 0
                        ? "text-green-600"
                        : flow.lastPrice?.change && flow.lastPrice.change < 0
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {formatPercentage(flow.lastPrice?.change ?? null)}
                  </span>
                </TableCell>
                <TableCell className="text-center">{formatPercentage(flow.lastPrice?.ytm ?? null)}</TableCell>
                <TableCell className="text-center">{formatDuration(flow.lastPrice?.duration_y ?? null)}</TableCell>
                <TableCell className="text-center bg-rose-50">
                  {formatDate(flow.details?.fecha_vencimiento ?? null)}
                </TableCell>
                <TableCell className="text-center bg-rose-50">{flow.details?.legislacion || ""}</TableCell>
                <TableCell className="text-center bg-rose-50">{flow.details?.jurisdiccion_pago || ""}</TableCell>
                <TableCell className="text-center bg-rose-50">{formatPercentage(flow.cupon)}</TableCell>
                <TableCell className="text-center bg-rose-50">
                  {formatAmount(flow.details?.lamina_minima ?? null)}
                </TableCell>
                <TableCell className="text-center bg-rose-50">
                  {flow.details?.calleable !== undefined ? (
                    <Badge variant={flow.details.calleable ? "default" : "secondary"}>
                      {flow.details.calleable ? "Sí" : "No"}
                    </Badge>
                  ) : (
                    ""
                  )}
                </TableCell>
                <TableCell className="text-center bg-rose-50">
                  {formatAmount(flow.details?.monto_residual ?? null)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Mantén Shift + rueda del mouse para desplazarte horizontalmente • Mostrando {filteredAndSortedFlows.length} de {flows.length} registros
      </div>
    </div>
  )
}
