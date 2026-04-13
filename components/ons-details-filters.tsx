"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarIcon, Filter, X, Search } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface FiltersShape {
  legislacion?: string
  jurisdiccionPago?: string
  emisores?: string[]
  fechaVencimientoHasta?: Date
}

interface DetailsFiltersProps {
  legislaciones: string[]
  jurisdicciones: string[]
  emisores: string[]
  onFiltersChange: (filters: FiltersShape) => void
}

const STORAGE_KEY = "onsDetailsFilters"

export function ONSDetailsFilters({ legislaciones, jurisdicciones, emisores, onFiltersChange }: DetailsFiltersProps) {
  const [legislacion, setLegislacion] = useState<string>("all")
  const [jurisdiccionPago, setJurisdiccionPago] = useState<string>("all")
  const [selectedEmisores, setSelectedEmisores] = useState<string[]>([])
  const [fechaVencimientoHasta, setFechaVencimientoHasta] = useState<Date>()
  const [emisorSearch, setEmisorSearch] = useState<string>("")
  const [dateInput, setDateInput] = useState<string>("")

  // 1) Cargar filtros persistidos al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        legislacion?: string
        jurisdiccionPago?: string
        emisores?: string[]
        fechaVencimientoHasta?: string // guardado como ISO
      }

      setLegislacion(parsed.legislacion ?? "all")
      setJurisdiccionPago(parsed.jurisdiccionPago ?? "all")
      setSelectedEmisores(parsed.emisores ?? [])
      if (parsed.fechaVencimientoHasta) {
        const d = new Date(parsed.fechaVencimientoHasta)
        if (!isNaN(d.getTime())) {
          setFechaVencimientoHasta(d)
          setDateInput(format(d, "yyyy-MM-dd"))
        }
      }
    } catch {
      // si hay error de parseo, ignoramos
    }
  }, [])

  // 2) Si cambian los emisores (por refetch), mantener los seleccionados que sigan existiendo
  useEffect(() => {
    if (!emisores?.length) return
    setSelectedEmisores((prev) => prev.filter((e) => emisores.includes(e)))
  }, [emisores])

  // 3) Persistir cualquier cambio de estado de filtros
  useEffect(() => {
    try {
      const payload = {
        legislacion,
        jurisdiccionPago,
        emisores: selectedEmisores,
        fechaVencimientoHasta: fechaVencimientoHasta ? fechaVencimientoHasta.toISOString() : undefined,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // sin storage disponible: no pasa nada
    }
  }, [legislacion, jurisdiccionPago, selectedEmisores, fechaVencimientoHasta])

  const filteredEmisores = useMemo(
    () => emisores.filter((em) => em.toLowerCase().includes(emisorSearch.toLowerCase())),
    [emisores, emisorSearch]
  )

  const handleEmisorChange = (emisor: string, checked: boolean) => {
    setSelectedEmisores((prev) => {
      if (checked) {
        if (prev.includes(emisor)) return prev
        return [...prev, emisor]
      }
      return prev.filter((e) => e !== emisor)
    })
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
      parsedDate = new Date(Number(year), Number(month) - 1, Number(day))
    } else if (formats[2].test(value)) {
      const [day, month, year] = value.split("-")
      parsedDate = new Date(Number(year), Number(month) - 1, Number(day))
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
      legislacion: legislacion === "all" ? undefined : legislacion,
      jurisdiccionPago: jurisdiccionPago === "all" ? undefined : jurisdiccionPago,
      emisores: selectedEmisores.length > 0 ? selectedEmisores : undefined,
      fechaVencimientoHasta,
    })
  }

  const handleClearFilters = () => {
    setLegislacion("all")
    setJurisdiccionPago("all")
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
          <Filter className="h-5 w-5" />
          Filtros - Detalles ONs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Legislación</label>
            <Select value={legislacion} onValueChange={setLegislacion}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las legislaciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las legislaciones</SelectItem>
                {legislaciones.filter(Boolean).map((leg) => (
                  <SelectItem key={leg} value={leg}>
                    {leg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Jurisdicción de Pago</label>
            <Select value={jurisdiccionPago} onValueChange={setJurisdiccionPago}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las jurisdicciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las jurisdicciones</SelectItem>
                {jurisdicciones.filter(Boolean).map((jur) => (
                  <SelectItem key={jur} value={jur}>
                    {jur}
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
                        // shadcn Checkbox emite boolean | "indeterminate"
                        onCheckedChange={(checked) => handleEmisorChange(emisor, checked === true)}
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
                  <Calendar mode="single" selected={fechaVencimientoHasta} onSelect={handleCalendarDateSelect} initialFocus />
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
