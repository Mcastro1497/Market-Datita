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
      const { data, error } = await supabase.from("instruments").select("*").order("symbol")

      if (error) throw error
      setTickers(data || [])
    } catch (error) {
      console.error("Error fetching tickers:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterTickers = () => {
    let filtered = tickers

    if (searchTerm) {
      filtered = filtered.filter(
        (ticker) =>
          ticker.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ticker.legislacion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ticker.sector?.toLowerCase().includes(searchTerm.toLowerCase()),
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
              <SelectItem value="Soberanos ARS">Soberanos ARS</SelectItem> {/* Added Soberanos ARS filter option */}
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
                <TableHead>Sector</TableHead>
                <TableHead>Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
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
                    <TableCell>{formatDate(ticker.fecha_vencimiento)}</TableCell>
                    <TableCell>{formatCurrency(ticker.monto_residual)}</TableCell>
                    <TableCell>
                      <Badge variant={ticker.calleable ? "destructive" : "outline"}>
                        {ticker.calleable ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>{ticker.legislacion || "-"}</TableCell>
                    <TableCell>{ticker.jurisdiccion_pago || "-"}</TableCell>
                    <TableCell>{ticker.sector || "-"}</TableCell>
                    <TableCell>{ticker.rating || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Mostrando {filteredTickers.length} de {tickers.length} instrumentos
        </div>
      </CardContent>
    </Card>
  )
}
