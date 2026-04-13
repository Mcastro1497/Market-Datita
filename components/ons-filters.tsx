"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarIcon, Filter, X, Search } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface FiltersProps {
  emisores: string[]
  onFiltersChange: (filters: {
    emisores?: string[]
    ticker?: string
    fechaDesde?: Date
    fechaHasta?: Date
  }) => void
}

const STORAGE_KEY = "onsFilters" // Added storage key for persistence

export function ONSFilters({ emisores, onFiltersChange }: FiltersProps) {
  const [selectedEmisores, setSelectedEmisores] = useState<string[]>([])
  const [emisorSearch, setEmisorSearch] = useState("")
  const [ticker, setTicker] = useState<string>("")
  const [fechaDesde, setFechaDesde] = useState<Date>()
  const [fechaHasta, setFechaHasta] = useState<Date>()
  const [fechaDesdeText, setFechaDesdeText] = useState("")
  const [fechaHastaText, setFechaHastaText] = useState("")

  const safeEmisores = emisores || []

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        emisores?: string[]
        ticker?: string
        fechaDesde?: string
        fechaHasta?: string
      }

      setSelectedEmisores(parsed.emisores ?? [])
      setTicker(parsed.ticker ?? "")
      if (parsed.fechaDesde) {
        const d = new Date(parsed.fechaDesde)
        if (!isNaN(d.getTime())) {
          setFechaDesde(d)
          setFechaDesdeText(format(d, "yyyy-MM-dd"))
        }
      }
      if (parsed.fechaHasta) {
        const d = new Date(parsed.fechaHasta)
        if (!isNaN(d.getTime())) {
          setFechaHasta(d)
          setFechaHastaText(format(d, "yyyy-MM-dd"))
        }
      }
    } catch {
      // ignore parsing errors
    }
  }, [])

  useEffect(() => {
    if (!safeEmisores.length) return
    setSelectedEmisores((prev) => prev.filter((e) => safeEmisores.includes(e)))
  }, [safeEmisores])

  useEffect(() => {
    try {
      const payload = {
        emisores: selectedEmisores,
        ticker,
        fechaDesde: fechaDesde?.toISOString(),
        fechaHasta: fechaHasta?.toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // no storage available
    }
  }, [selectedEmisores, ticker, fechaDesde, fechaHasta])

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null

    const formats = [/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{2})\/(\d{2})\/(\d{4})$/, /^(\d{2})-(\d{2})-(\d{4})$/]

    for (const format of formats) {
      const match = dateStr.match(format)
      if (match) {
        let year, month, day
        if (format === formats[0]) {
          ;[, year, month, day] = match
        } else {
          ;[, day, month, year] = match
        }
        const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
        if (!isNaN(date.getTime())) return date
      }
    }
    return null
  }

  const handleFechaDesdeTextChange = (value: string) => {
    setFechaDesdeText(value)
    const parsed = parseDate(value)
    if (parsed) setFechaDesde(parsed)
  }

  const handleFechaHastaTextChange = (value: string) => {
    setFechaHastaText(value)
    const parsed = parseDate(value)
    if (parsed) setFechaHasta(parsed)
  }

  const handleFechaDesdeSelect = (date: Date | undefined) => {
    setFechaDesde(date)
    setFechaDesdeText(date ? format(date, "yyyy-MM-dd") : "")
  }

  const handleFechaHastaSelect = (date: Date | undefined) => {
    setFechaHasta(date)
    setFechaHastaText(date ? format(date, "yyyy-MM-dd") : "")
  }

  const handleEmisorToggle = (emisor: string) => {
    setSelectedEmisores((prev) => (prev.includes(emisor) ? prev.filter((e) => e !== emisor) : [...prev, emisor]))
  }

  const filteredEmisores = safeEmisores.filter((emisor) => emisor.toLowerCase().includes(emisorSearch.toLowerCase()))

  const handleApplyFilters = () => {
    onFiltersChange({
      emisores: selectedEmisores.length > 0 ? selectedEmisores : undefined,
      ticker: ticker || undefined,
      fechaDesde,
      fechaHasta,
    })
  }

  const handleClearFilters = () => {
    setSelectedEmisores([])
    setEmisorSearch("")
    setTicker("")
    setFechaDesde(undefined)
    setFechaHasta(undefined)
    setFechaDesdeText("")
    setFechaHastaText("")
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    onFiltersChange({})
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Emisores</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                  {selectedEmisores.length > 0
                    ? `${selectedEmisores.length} seleccionado${selectedEmisores.length > 1 ? "s" : ""}`
                    : "Seleccionar emisores"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar emisor..."
                      value={emisorSearch}
                      onChange={(e) => setEmisorSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-3">
                  {filteredEmisores.length > 0 ? (
                    filteredEmisores.map((emisor) => (
                      <div key={emisor} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`emisor-${emisor}`}
                          checked={selectedEmisores.includes(emisor)}
                          onCheckedChange={() => handleEmisorToggle(emisor)}
                        />
                        <label htmlFor={`emisor-${emisor}`} className="text-sm cursor-pointer flex-1">
                          {emisor}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No se encontraron emisores</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Ticker</label>
            <Input placeholder="Buscar ticker..." value={ticker} onChange={(e) => setTicker(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Fecha desde</label>
            <div className="space-y-2">
              <Input
                placeholder="YYYY-MM-DD"
                value={fechaDesdeText}
                onChange={(e) => handleFechaDesdeTextChange(e.target.value)}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaDesde ? format(fechaDesde, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={fechaDesde} onSelect={handleFechaDesdeSelect} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Fecha hasta</label>
            <div className="space-y-2">
              <Input
                placeholder="YYYY-MM-DD"
                value={fechaHastaText}
                onChange={(e) => handleFechaHastaTextChange(e.target.value)}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaHasta ? format(fechaHasta, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={fechaHasta} onSelect={handleFechaHastaSelect} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleApplyFilters} className="flex-1">
            Aplicar Filtros
          </Button>
          <Button variant="outline" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
