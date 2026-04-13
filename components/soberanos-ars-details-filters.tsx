"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarIcon, X, Search, PiggyBank } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface SoberanosArsDetailsFiltersProps {
  monedas: string[]
  emisores: string[]
  onFiltersChange: (filters: {
    moneda?: string
    emisores?: string[]
    fechaVencimientoHasta?: Date
  }) => void
}

const STORAGE_KEY = "soberanosArsDetailsFilters" // Added storage key for persistence

export function SoberanosArsDetailsFilters({ monedas, emisores, onFiltersChange }: SoberanosArsDetailsFiltersProps) {
  const [moneda, setMoneda] = useState<string>("all")
  const [selectedEmisores, setSelectedEmisores] = useState<string[]>([])
  const [fechaVencimientoHasta, setFechaVencimientoHasta] = useState<Date>()
  const [emisorSearch, setEmisorSearch] = useState<string>("")
  const [dateInput, setDateInput] = useState<string>("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        moneda?: string
        emisores?: string[]
        fechaVencimientoHasta?: string
      }

      setMoneda(parsed.moneda ?? "all")
      setSelectedEmisores(parsed.emisores ?? [])
      if (parsed.fechaVencimientoHasta) {
        const d = new Date(parsed.fechaVencimientoHasta)
        if (!isNaN(d.getTime())) {
          setFechaVencimientoHasta(d)
          setDateInput(format(d, "yyyy-MM-dd"))
        }
      }
    } catch {
      // ignore parsing errors
    }
  }, [])

  useEffect(() => {
    if (!emisores?.length) return
    setSelectedEmisores((prev) => prev.filter((e) => emisores.includes(e)))
  }, [emisores])

  useEffect(() => {
    try {
      const payload = {
        moneda,
        emisores: selectedEmisores,
        fechaVencimientoHasta: fechaVencimientoHasta?.toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // no storage available
    }
  }, [moneda, selectedEmisores, fechaVencimientoHasta])

  const filteredEmisores = emisores.filter((emisor) => emisor.toLowerCase().includes(emisorSearch.toLowerCase()))

  const handleEmisorChange = (emisor: string, checked: boolean) => {
    if (checked) {
      setSelectedEmisores([...selectedEmisores, emisor])
    } else {
      setSelectedEmisores(selectedEmisores.filter((e) => e !== emisor))
    }
  }

  const handleDateInputChange = (value: string) => {
    setDateInput(value)

    const formats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    ]

    let parsedDate: Date | undefined

    if (formats[0].test(value)) {
      parsedDate = new Date(value)
    } else if (formats[1].test(value)) {
      const [day, month, year] = value.split("/")
      parsedDate = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
    } else if (formats[2].test(value)) {
      const [day, month, year] = value.split("-")
      parsedDate = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
    }

    if (parsedDate && !isNaN(parsedDate.getTime())) {
      setFechaVencimientoHasta(parsedDate)
    } else if (value === "") {
      setFechaVencimientoHasta(undefined)
    }
  }

  const handleCalendarDateSelect = (date: Date | undefined) => {
    setFechaVencimientoHasta(date)
    setDateInput(date ? format(date, "yyyy-MM-dd") : "")
  }

  const handleApplyFilters = () => {
    onFiltersChange({
      moneda: moneda === "all" ? undefined : moneda,
      emisores: selectedEmisores.length > 0 ? selectedEmisores : undefined,
      fechaVencimientoHasta,
    })
  }

  const handleClearFilters = () => {
    setMoneda("all")
    setSelectedEmisores([])
    setFechaVencimientoHasta(undefined)
    setEmisorSearch("")
    setDateInput("")
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    onFiltersChange({})
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-orange-600" />
          Filtros - Soberanos ARS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Moneda</label>
            <Select value={moneda} onValueChange={setMoneda}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las monedas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las monedas</SelectItem>
                {monedas.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Emisores</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                  {selectedEmisores.length > 0 ? `${selectedEmisores.length} seleccionado(s)` : "Seleccionar emisores"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="mb-3">
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
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredEmisores.map((emisor) => (
                    <div key={emisor} className="flex items-center space-x-2">
                      <Checkbox
                        id={emisor}
                        checked={selectedEmisores.includes(emisor)}
                        onCheckedChange={(checked) => handleEmisorChange(emisor, checked as boolean)}
                      />
                      <label
                        htmlFor={emisor}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {emisor}
                      </label>
                    </div>
                  ))}
                  {filteredEmisores.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron emisores que coincidan con "{emisorSearch}"
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Fecha de Vencimiento Hasta</label>
            <div className="space-y-2">
              <Input
                placeholder="YYYY-MM-DD, DD/MM/YYYY o DD-MM-YYYY"
                value={dateInput}
                onChange={(e) => handleDateInputChange(e.target.value)}
                className="text-sm"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaVencimientoHasta
                      ? format(fechaVencimientoHasta, "dd/MM/yyyy", { locale: es })
                      : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fechaVencimientoHasta}
                    onSelect={handleCalendarDateSelect}
                    initialFocus
                  />
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
