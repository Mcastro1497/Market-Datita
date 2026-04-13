"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import type { ONFlow } from "@/lib/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface ONSTableProps {
  data: ONFlow[]
}

type SortField = keyof ONFlow
type SortDirection = "asc" | "desc"

export function ONSTable({ data }: ONSTableProps) {
  const [sortField, setSortField] = useState<SortField>("fecha_pago")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // === FIX FECHAS: tratar "YYYY-MM-DD" como fecha LOCAL (evita -1 día por TZ) ===
  function parseLocalISODate(value?: string | Date | null) {
    if (!value) return null
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value
    const s = String(value)
    // Caso típico de Supabase DATE: "YYYY-MM-DD"
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
      const [, y, mo, d] = m
      return new Date(Number(y), Number(mo) - 1, Number(d)) // local time sin TZ
    }
    // Si viene con hora/Z, usamos Date normal
    const d2 = new Date(s)
    return isNaN(d2.getTime()) ? null : d2
  }

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]

    // Orden especial para fecha_pago usando parser local
    if (sortField === "fecha_pago") {
      const ad = parseLocalISODate(aValue as any)?.getTime() ?? -Infinity
      const bd = parseLocalISODate(bValue as any)?.getTime() ?? -Infinity
      return sortDirection === "asc" ? ad - bd : bd - ad
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) {
      return "N/A"
    }
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) {
      return "N/A"
    }
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatAmortization = (value: number | null) => {
    if (value === null || value === undefined) {
      return ""
    }
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) {
      return "N/A"
    }
    return `${value.toFixed(2)}%`
  }

  const formatCuponPercentage = (value: number | null) => {
    if (value === null || value === undefined) {
      return "N/A"
    }
    return `${(value * 100).toFixed(2)}%`
  }

  const formatResidualValue = (value: number | null) => {
    if (value === null || value === undefined) {
      return "N/A"
    }
    return (value * 100).toFixed(0)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujos de ONs ({data.length} registros)</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="rounded-md border overflow-auto max-h-[70vh] relative"
          onWheel={(e) => {
            // Enable horizontal scrolling with mouse wheel when shift is pressed
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
            <TableHeader className="sticky top-0 bg-white z-20 shadow-md border-b">
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("fecha_pago")} className="h-auto p-0 font-semibold">
                    Fecha Pago <SortIcon field="fecha_pago" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("emisor")} className="h-auto p-0 font-semibold">
                    Emisor <SortIcon field="emisor" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort("ticker")} className="h-auto p-0 font-semibold">
                    Ticker <SortIcon field="ticker" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button variant="ghost" onClick={() => handleSort("interes")} className="h-auto p-0 font-semibold">
                    Interés <SortIcon field="interes" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("amortizacion")}
                    className="h-auto p-0 font-semibold"
                  >
                    Amortización <SortIcon field="amortizacion" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button variant="ghost" onClick={() => handleSort("total")} className="h-auto p-0 font-semibold">
                    Total <SortIcon field="total" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">Moneda</TableHead>
                <TableHead className="text-center">
                  <Button variant="ghost" onClick={() => handleSort("dias")} className="h-auto p-0 font-semibold">
                    Días <SortIcon field="dias" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button variant="ghost" onClick={() => handleSort("cupon")} className="h-auto p-0 font-semibold">
                    Cupón <SortIcon field="cupon" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("valor_residual")}
                    className="h-auto p-0 font-semibold"
                  >
                    Valor Residual <SortIcon field="valor_residual" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((flow) => (
                <TableRow key={flow.id}>
                  <TableCell className="font-mono">
                    {(() => {
                      const d = parseLocalISODate(flow.fecha_pago)
                      return d ? format(d, "dd/MM/yyyy", { locale: es }) : "N/A"
                    })()}
                  </TableCell>
                  <TableCell className="font-medium">{flow.emisor}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {flow.ticker}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono">{formatCurrency(flow.interes)}</TableCell>
                  <TableCell className="text-center font-mono">{formatAmortization(flow.amortizacion)}</TableCell>
                  <TableCell className="text-center font-mono">{formatCurrency(flow.total)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{flow.moneda_pago}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono">{flow.dias}</TableCell>
                  <TableCell className="text-center font-mono">{formatCuponPercentage(flow.cupon)}</TableCell>
                  <TableCell className="text-center font-mono">{formatResidualValue(flow.valor_residual)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-xs text-muted-foreground mt-2 text-center">
          Mantén Shift + rueda del mouse para desplazarte horizontalmente
        </div>
      </CardContent>
    </Card>
  )
}
