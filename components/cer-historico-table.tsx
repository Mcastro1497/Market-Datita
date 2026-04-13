"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, TrendingUpIcon } from "lucide-react"
import type { CerHistorico } from "@/lib/types"

export default function CerHistoricoTable() {
  const [data, setData] = useState<CerHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredData, setFilteredData] = useState<CerHistorico[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const filtered = data.filter((item) => item.fecha.toLowerCase().includes(searchTerm.toLowerCase()))
    setFilteredData(filtered)
  }, [data, searchTerm])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: cerData, error } = await supabase
        .from("cer_historico")
        .select("*")
        .order("fecha", { ascending: false })

      if (error) {
        console.error("Error fetching CER data:", error)
        return
      }

      setData(cerData || [])
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-AR")
  }

  const formatCerValue = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5" />
            Histórico CER
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Cargando datos...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUpIcon className="h-5 w-5" />
          Histórico CER
        </CardTitle>
        <CardDescription>Coeficiente de Estabilización de Referencia - {filteredData.length} registros</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Buscar por fecha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Button onClick={fetchData} variant="outline">
            Actualizar
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Fecha
                  </div>
                </TableHead>
                <TableHead className="text-right">Valor CER</TableHead>
                <TableHead className="text-right">Variación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item, index) => {
                const prevItem = filteredData[index + 1]
                const variation = prevItem ? ((item.valor_cer - prevItem.valor_cer) / prevItem.valor_cer) * 100 : 0

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{formatDate(item.fecha)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCerValue(item.valor_cer)}</TableCell>
                    <TableCell className="text-right">
                      {prevItem && (
                        <Badge variant={variation >= 0 ? "default" : "destructive"} className="font-mono">
                          {variation >= 0 ? "+" : ""}
                          {variation.toFixed(4)}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {filteredData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No se encontraron registros</div>
        )}
      </CardContent>
    </Card>
  )
}
