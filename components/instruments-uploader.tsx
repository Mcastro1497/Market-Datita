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

function parseCalleable(value: any): boolean {
  if (value === undefined || value === null) return false
  const s = String(value).toLowerCase().trim()
  return ["sí","si","yes","true","verdadero","1"].includes(s) || value === true
}

export function InstrumentsUploader({ onUploadComplete }: Props) {
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

      setProgress(50)

      const processed = jsonData.map((row: any) => {
        // Acepta tanto "symbol" como "Ticker"
        const ticker = (row["symbol"] || row["Ticker"] || row["ticker"] || "").toString().trim().toUpperCase()
        const instrType = (row["instrument_type"] || "").toString().trim().toUpperCase()
        return {
          symbol:            ticker,
          instrument_type:   ["ON","HD","ARS"].includes(instrType) ? instrType : "ON",
          segment:           row["segment"] || "24hs",
          is_active:         row["is_active"] !== undefined ? Boolean(row["is_active"]) : true,
          emisor:            row["emisor"] || null,
          legislacion:       row["legislacion"] || null,
          jurisdiccion_pago: row["jurisdiccion_pago"] || null,
          fecha_vencimiento: parseDate(row["fecha_vencimiento"]),
          lamina_minima:     row["lamina_minima"] != null && !isNaN(Number(row["lamina_minima"])) ? Number(row["lamina_minima"]) : null,
          monto_residual:    row["monto_residual"] != null && !isNaN(Number(row["monto_residual"])) ? Number(row["monto_residual"]) : null,
          calleable:         parseCalleable(row["calleable"]),
          moneda:            row["moneda"] || null,
          tipo:              row["tipo"] || null,
          cer_emision:       row["cer_emision"] != null && !isNaN(Number(row["cer_emision"])) ? Number(row["cer_emision"]) : null,
          cupon:             row["cupon"] != null && !isNaN(Number(row["cupon"])) ? Number(row["cupon"]) : null,
          _valid:            !!ticker,
        }
      })

      const valid = processed.filter(r => r._valid)
      const invalid = processed.length - valid.length
      const toUpsert = valid.map(({ _valid, ...rest }) => rest)

      setProgress(70)

      if (toUpsert.length > 0) {
        const { error } = await supabase.from("instruments").upsert(toUpsert)
        if (error) throw error
      }

      setProgress(100)
      let msg = `${toUpsert.length} instrumentos cargados/actualizados.`
      if (invalid > 0) msg += ` ${invalid} filas omitidas por symbol/ticker faltante.`
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
        <CardTitle className="flex items-center gap-2 text-green-600">
          <FileSpreadsheet className="h-5 w-5" />
          Cargar Instrumentos
        </CardTitle>
        <CardDescription>
          Headers exactos de la tabla: symbol, instrument_type, segment, is_active, emisor, legislacion, jurisdiccion_pago, fecha_vencimiento, lamina_minima, monto_residual, calleable, moneda, tipo, cer_emision, cupon
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-gray-400"
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {isDragActive ? (
            <p className="text-green-600">Soltá el archivo aquí...</p>
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
