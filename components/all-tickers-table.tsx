"use client"

import { useState, useEffect, useMemo } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter } from "lucide-react"

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
}

export function AllTickersTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [refFilter, setRefFilter] = useState<string>("all")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from("instruments_v2")
          .select(
            "symbol, tipo_activo, referencias, moneda_pago, vencimiento, vr_vigente, callable, legislacion, jurisdiccion_pago",
          )
          .eq("is_active", true)
          .order("symbol")
        if (error) throw error
        setRows((data as Row[]) || [])
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
      return matchesSearch && matchesType && matchesRef
    })
  }, [rows, searchTerm, typeFilter, refFilter])

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
                  <TableRow key={r.symbol}>
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
          Mostrando {filtered.length} de {rows.length} instrumentos
        </div>
      </CardContent>
    </Card>
  )
}
