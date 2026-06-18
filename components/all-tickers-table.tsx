"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AllTicker } from "@/lib/types"
import { Search, Filter } from "lucide-react"

// instruments_v2 usa symbol/instrument_type; derivamos el tipo de activo legible.
function tipoActivo(i: any): string {
  const t = i.instrument_type
  const ref = (i.referencias || "").trim()
  if (t === "ON") return "Obligacion Negociable"
  if (t === "HD") return "Soberanos Hard Dollar"
  if (t === "DLK" || ref === "A3500") return "Dólar Linked"
  if (i.moneda_pago === "ARS") return "Soberanos ARS"
  return t || "Otro"
}

export function AllTickersTable() {
  const [tickers, setTickers] = useState<AllTicker[]>([])
  const [filteredTickers, setFilteredTickers] = useState<AllTicker[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchAllTickers()
  }, [])

  useEffect(() => {
    filterTickers()
  }, [tickers, searchTerm, typeFilter])

  const fetchAllTickers = async () => {
    try {
      const { data, error } = await supabase
        .from("instruments_v2")
        .select("*")
        .eq("is_active", true)
        .order("symbol")

      if (error) throw error
      // Mapeamos a la forma que usa la tabla (ticker / tipo_activo)
      const mapped = (data || []).map((i: any) => ({
        ...i,
        ticker: i.symbol,
        tipo_activo: tipoActivo(i),
      })) as AllTicker[]
      setTickers(mapped)
    } catch (error) {
      console.error("Error fetching tickers:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterTickers = () => {
    let filtered = tickers

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (ticker) =>
          ticker.ticker?.toLowerCase().includes(q) ||
          ticker.tipo_activo?.toLowerCase().includes(q) ||
          ticker.legislacion?.toLowerCase().includes(q),
      )
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((ticker) => ticker.tipo_activo === typeFilter)
    }

    setFilteredTickers(filtered)
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-"
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("es-AR")
  }

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
        <CardDescription>Vista consolidada de todos los instrumentos (ONs y Soberanos HD)</CardDescription>

        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por ticker, legislación o sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="Obligacion Negociable">Obligación Negociable</SelectItem>
              <SelectItem value="Soberanos Hard Dollar">Soberanos Hard Dollar</SelectItem>
              <SelectItem value="Soberanos ARS">Soberanos ARS</SelectItem>
              <SelectItem value="Dólar Linked">Dólar Linked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Tipo de Activo</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Monto Residual</TableHead>
                <TableHead>Calleable</TableHead>
                <TableHead>Legislación</TableHead>
                <TableHead>Jurisdicción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron instrumentos
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickers.map((ticker) => (
                  <TableRow key={`${ticker.ticker}-${ticker.tipo_activo}`}>
                    <TableCell className="font-medium">{ticker.ticker}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ticker.tipo_activo === "Obligacion Negociable"
                            ? "default"
                            : ticker.tipo_activo === "Soberanos Hard Dollar"
                              ? "secondary"
                              : ticker.tipo_activo === "Soberanos ARS"
                                ? "success"
                                : // Added styling for Soberanos ARS badge
                                  "outline"
                        }
                      >
                        {ticker.tipo_activo}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(ticker.vencimiento)}</TableCell>
                    <TableCell>{formatCurrency(ticker.vr_vigente)}</TableCell>
                    <TableCell>
                      <Badge variant={ticker.callable ? "destructive" : "outline"}>
                        {ticker.callable ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>{ticker.legislacion || "-"}</TableCell>
                    <TableCell>{ticker.jurisdiccion_pago || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Mostrando {filteredTickers.length} de {tickers.length} instrumentos
        </div>
      </CardContent>
    </Card>
  )
}
