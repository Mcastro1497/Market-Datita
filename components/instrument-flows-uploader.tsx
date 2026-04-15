"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import * as XLSX from "xlsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Props {
  onUploadComplete: () => void
}

function parseDate(value: any): string | null {
  if (!value) return null
  let date: Date
  if (typeof value === "number") {
    date = new Date((value - 25569) * 86400 * 1000)
  } else {
    const s = String(value).trim()
    const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
    if (m) {
      date = new Date(`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`)
    } else {
      date = new Date(s)
    }
  }
  return isNaN(date.getTime()) ? null : date.toISOString().split("T")[0]
}

export function InstrumentFlowsUploader({ onUploadComplete }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const supabase = createClient()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setUploading(true)
    setProgress(0)
    setMessage(null)

    try {
      setProgress(20)
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "buffer" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(ws) as any[]

      setProgress(40)

      const processed = jsonData.map((row: any) => {
        const ticker = (row["Ticker"] || row["ticker"] || "").toString().trim().toUpperCase()
        const fechaPago = parseDate(row["Fecha de pago"] || row["fecha_pago"] || row["Fecha"] || row["fecha"])
        return {
          symbol:         ticker,
          fecha_pago:     fechaPago,
          interes:        row["Interés"] != null && !isNaN(Number(row["Interés"]))           ? Number(row["Interés"])           : null,
          amortizacion:   row["Amortización"] != null && !isNaN(Number(row["Amortización"])) ? Number(row["Amortización"])      : null,
          total:          row["Total"] != null && !isNaN(Number(row["Total"]))               ? Number(row["Total"])             : null,
          moneda_pago:    row["Mon. pago"] || row["moneda_pago"] || null,
          dias:           row["Días"] != null && !isNaN(Number(row["Días"]))                 ? Number(row["Días"])              : null,
          cupon:          row["Cupón"] != null && !isNaN(Number(row["Cupón"]))               ? Number(row["Cupón"])             : null,
          valor_residual: row["Valor residual"] != null && !isNaN(Number(row["Valor residual"])) ? Number(row["Valor residual"]) : null,
          tipo:           row["tipo"] || row["Tipo"] || null,
          _valid:         !!ticker && !!fechaPago,
        }
      })

      const valid = processed.filter(r => r._valid)
      const invalid = processed.length - valid.length

      setProgress(60)

      // Verificar que los symbols existen en instruments
      const symbols = [...new Set(valid.map(r => r.symbol))]
      const { data: existingInstr } = await supabase
        .from("instruments").select("symbol").in("symbol", symbols)
      const validSymbols = new Set(existingInstr?.map((i: any) => i.symbol) || [])
      const unknownSymbols = symbols.filter(s => !validSymbols.has(s))

      const toInsert = valid
        .filter(r => validSymbols.has(r.symbol))
        .map(({ _valid, ...rest }) => rest)

      setProgress(80)

      if (toInsert.length > 0) {
        const { error } = await supabase.from("instrument_flows").insert(toInsert)
        if (error) throw error
      }

      setProgress(100)
      let msg = `${toInsert.length} flujos cargados correctamente.`
      if (invalid > 0) msg += ` ${invalid} filas omitidas por datos inválidos.`
      if (unknownSymbols.length > 0) msg += ` Symbols no encontrados en instruments: ${unknownSymbols.slice(0,5).join(", ")}.`
      setMessage({ type: "success", text: msg })
      onUploadComplete()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error al procesar el archivo" })
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }, [supabase, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-600">
          <FileSpreadsheet className="h-5 w-5" />
          Cargar Flujos de Pagos
        </CardTitle>
        <CardDescription>
          Columnas requeridas: Ticker, Fecha de pago, Total — Opcionales: Interés, Amortización, Mon. pago, Días, Cupón, Valor residual, tipo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {isDragActive ? (
            <p className="text-blue-600">Soltá el archivo aquí...</p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">Arrastrá tu Excel aquí, o hacé clic para seleccionar</p>
              <p className="text-sm text-gray-500">Formatos: .xlsx, .xls</p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-600 mt-2">Procesando...</p>
          </div>
        )}

        {message && (
          <Alert className={`mt-4 ${message.type === "error" ? "border-red-200" : "border-green-200"}`}>
            {message.type === "success"
              ? <CheckCircle className="h-4 w-4 text-green-600" />
              : <AlertCircle className="h-4 w-4 text-red-600" />}
            <AlertDescription className={message.type === "error" ? "text-red-700" : "text-green-700"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
