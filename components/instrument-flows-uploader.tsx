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
        // Acepta tanto "symbol" como "Ticker"
        const symbol = (row["symbol"] || row["Ticker"] || row["ticker"] || "").toString().trim().toUpperCase()
        const fechaPago = parseDate(row["fecha_pago"] || row["Fecha de pago"] || row["Fecha"])
        return {
          symbol,
          fecha_pago:     fechaPago,
          interes:        row["interes"] != null && !isNaN(Number(row["interes"]))           ? Number(row["interes"])           : null,
          amortizacion:   row["amortizacion"] != null && !isNaN(Number(row["amortizacion"])) ? Number(row["amortizacion"])      : null,
          total:          row["total"] != null && !isNaN(Number(row["total"]))               ? Number(row["total"])             : null,
          moneda_pago:    row["moneda_pago"] || row["Mon. pago"] || null,
          dias:           row["dias"] != null && !isNaN(Number(row["dias"]))                 ? Number(row["dias"])              : null,
          cupon:          row["cupon"] != null && !isNaN(Number(row["cupon"]))               ? Number(row["cupon"])             : null,
          valor_residual: row["valor_residual"] != null && !isNaN(Number(row["valor_residual"])) ? Number(row["valor_residual"]) : null,
          tipo:           row["tipo"] || null,
          _valid:         !!symbol && !!fechaPago,
        }
      })

      const valid = processed.filter(r => r._valid)
      const invalid = processed.length - valid.length

      setProgress(60)

      // Verificar que los symbols existen en instruments_v2
      const symbols = [...new Set(valid.map(r => r.symbol))]
      const { data: existingInstr } = await supabase
        .from("instruments_v2").select("symbol").in("symbol", symbols)
      const validSymbols = new Set(existingInstr?.map((i: any) => i.symbol) || [])
      const unknownSymbols = symbols.filter(s => !validSymbols.has(s))

      const toInsert = valid
        .filter(r => validSymbols.has(r.symbol))
        .map(({ _valid, ...rest }) => rest)

      setProgress(80)

      if (toInsert.length > 0) {
        const { error } = await supabase.from("instrument_flows_v2").insert(toInsert)
        if (error) throw error
      }

      setProgress(100)
      let msg = `${toInsert.length} flujos cargados correctamente.`
      if (invalid > 0) msg += ` ${invalid} filas omitidas por datos inválidos.`
      if (unknownSymbols.length > 0) msg += ` Symbols no encontrados en instruments_v2: ${unknownSymbols.slice(0,5).join(", ")}.`
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
        <CardTitle className="flex items-center gap-2 text-primary">
          <FileSpreadsheet className="h-5 w-5" />
          Cargar Flujos de Pagos
        </CardTitle>
        <CardDescription>
          Headers exactos: symbol, fecha_pago, interes, amortizacion, total, moneda_pago, dias, cupon, valor_residual, tipo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary/30 bg-primary/10" : "border-border hover:border-ring"
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          {isDragActive ? (
            <p className="text-primary">Soltá el archivo aquí...</p>
          ) : (
            <div>
              <p className="text-muted-foreground mb-2">Arrastrá tu Excel aquí, o hacé clic para seleccionar</p>
              <p className="text-sm text-muted-foreground">Formatos: .xlsx, .xls</p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">Procesando...</p>
          </div>
        )}

        {message && (
          <Alert className={`mt-4 ${message.type === "error" ? "border-destructive/30" : "border-success/30"}`}>
            {message.type === "success"
              ? <CheckCircle className="h-4 w-4 text-success" />
              : <AlertCircle className="h-4 w-4 text-destructive" />}
            <AlertDescription className={message.type === "error" ? "text-destructive" : "text-success"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
