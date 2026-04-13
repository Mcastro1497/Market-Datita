"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SoberanoWithDetails } from "@/lib/types"
import { ArrowUpDown, Search, PiggyBank } from "lucide-react"

interface SoberanosArsDetailsTableProps {
  flows: SoberanoWithDetails[]
  activeTab: string
}

export function SoberanosArsDetailsTable({ flows, activeTab }: SoberanosArsDetailsTableProps) {
  const [sortField, setSortField] = useState<string>("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [emisorFilter, setEmisorFilter] = useState<string>("")
  const [tipoFilter, setTipoFilter] = useState<string>("")

  const uniqueEmisors = useMemo(() => {
    const emisors = [...new Set(flows.map((flow) => flow.emisor))]
    return emisors.sort()
  }, [flows])

  const uniqueTipos = useMemo(() => {
    const tipos = [...new Set(flows.map((flow) => flow.details?.tipo).filter(Boolean) as string[])]
    return tipos.sort()
  }, [flows])

  // === Fix fechas: tratar "YYYY-MM-DD" como local (evita -1 día)
  function parseLocalISODate(dateString?: string | null) {
    if (!dateString) return null
    const s = String(dateString)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
      const [, y, mo, d] = m
      return new Date(Number(y), Number(mo) - 1, Number(d))
    }
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const filteredAndSortedFlows = useMemo(() => {
    const filtered = flows.filter((flow) => {
      const q = searchTerm.trim().toLowerCase()

      const matchesSearch =
        !q ||
        flow.ticker.toLowerCase().includes(q) ||
        flow.emisor.toLowerCase().includes(q)

      const matchesEmisor =
        !emisorFilter || emisorFilter === "all" || flow.emisor === emisorFilter

      const matchesTipo =
        !tipoFilter || tipoFilter === "all" || flow.details?.tipo === tipoFilter

      return matchesSearch && matchesEmisor && matchesTipo
    })

    if (sortField) {
      filtered.sort((a, b) => {
        // sort especial por vencimiento con parser local
        if (sortField === "details.fecha_vencimiento") {
          const da = parseLocalISODate(a.details?.fecha_vencimiento)?.getTime() ?? -Infinity
          const db = parseLocalISODate(b.details?.fecha_vencimiento)?.getTime() ?? -Infinity
          return sortDirection === "asc" ? da - db : db - da
        }

        let aValue: any
        let bValue: any

        if (sortField.includes(".")) {
          const [root, sub] = sortField.split(".")
          aValue = (a as any)?.[root]?.[sub]
          bValue = (b as any)?.[root]?.[sub]
        } else {
          aValue = (a as any)?.[sortField]
          bValue = (b as any)?.[sortField]
        }

        if (aValue == null && bValue == null) return 0
        if (aValue == null) return 1
        if (bValue == null) return -1

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortDirection === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        }
        return sortDirection === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number)
      })
    }

    return filtered
  }, [flows, searchTerm, emisorFilter, tipoFilter, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "—"
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatAmount = (value: number | null | undefined) => {
    if (value == null) return "—"
    return new Intl.NumberFormat("es-AR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }).format(value)
  }

  const formatDate = (dateString?: string | null) => {
    const d = parseLocalISODate(dateString)
    if (!d) return "—"
    return new Intl.DateTimeFormat("es-AR").format(d)
  }

  const formatPercentage = (value: number | null | undefined) => {
    if (value == null) return "—"
    return `${(value * 100).toFixed(2)}%`
  }

  const formatDuration = (value: number | null | undefined) => {
    if (value == null) return "—"
    return `${value.toFixed(2)} años`
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <PiggyBank className="h-5 w-5 text-orange-600" />
          <h3 className="font-semibold text-orange-800">Soberanos ARS</h3>
        </div>
        <p className="text-sm text-orange-700">
          Bonos soberanos denominados en pesos argentinos. Todos los valores están expresados en ARS.
        </p>
      </div>

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
            {uniqueEmisors.map((emisor) => (
              <SelectItem key={emisor} value={emisor}>
                {emisor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {uniqueTipos.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {tipo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                <Button variant="ghost" onClick={() => handleSort("details.tipo")} className="h-auto p-0 font-semibold">
                  Tipo <ArrowUpDown className="ml-2 h-4 w-4" />
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
                  onClick={() => handleSort("lastPrice.change")}
                  className="h-auto p-0 font-semibold"
                >
                  Var % <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("lastPrice.tna")}
                  className="h-auto p-0 font-semibold"
                >
                  TNA <ArrowUpDown className="ml-2 h-4 w-4" />
                   </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("lastPrice.ytm")}
                  className="h-auto p-0 font-semibold"
                >
                  TIR <ArrowUpDown className="ml-2 h-4 w-4" />
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
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("details.moneda")}
                  className="h-auto p-0 font-semibold"
                >
                  Moneda <ArrowUpDown className="ml-2 h-4 w-4" />
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
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("details.monto_residual")}
                  className="h-auto p-0 font-semibold"
                >
                  Monto Residual <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredAndSortedFlows.map((flow) => (
              <TableRow key={flow.id}>
                <TableCell className="text-center">{flow.emisor}</TableCell>
                <TableCell className="text-center font-medium">{flow.ticker}</TableCell>
                <TableCell className="text-center">{flow.details?.tipo ?? "—"}</TableCell>
                <TableCell className="text-center">{formatCurrency(flow.lastPrice?.last)}</TableCell>

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
                    {formatPercentage(flow.lastPrice?.change)}
                  </span>
                </TableCell>
                <TableCell className="text-center">{formatPercentage(flow.lastPrice?.tna)}</TableCell>
                <TableCell className="text-center">{formatPercentage(flow.lastPrice?.ytm)}</TableCell>
                <TableCell className="text-center">{formatDuration(flow.lastPrice?.duration_y)}</TableCell>
                <TableCell className="text-center">{formatDate(flow.details?.fecha_vencimiento)}</TableCell>
                <TableCell className="text-center">{flow.details?.moneda ?? "—"}</TableCell>
                <TableCell className="text-center">{formatAmount(flow.details?.lamina_minima)}</TableCell>
                <TableCell className="text-center">{formatAmount(flow.details?.monto_residual)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Mantén Shift + rueda del mouse para desplazarte horizontalmente • Mostrando {filteredAndSortedFlows.length} de {flows.length} registros de Soberanos ARS
      </div>
    </div>
  )
}
