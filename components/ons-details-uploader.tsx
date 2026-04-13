"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import * as XLSX from "xlsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ExcelDetailsRow {
  [key: string]: any
  Ticker: string
  fecha_vencimiento: string | number
  legislacion: string
  jurisdiccion_pago: string
  lamina_minima: string | number
  calleable: string | boolean
  monto_residual: string | number
}

interface ONSDetailsUploaderProps {
  onUploadComplete: () => void
}

export function ONSDetailsUploader({ onUploadComplete }: ONSDetailsUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createClient()

  const processExcelData = (data: ExcelDetailsRow[]) => {
    console.log("[v0] Procesando", data.length, "filas del Excel de detalles")

    if (data.length > 0) {
      const availableColumns = Object.keys(data[0])
      console.log("[v0] Columnas disponibles en el Excel:", availableColumns)
    }

    const processedData = data.map((row, index) => {
      const fechaVencimientoValue = row["fecha_vencimiento"]
      console.log(
        `[v0] Fila ${index + 1}: Fecha vencimiento original =`,
        fechaVencimientoValue,
        typeof fechaVencimientoValue,
      )

      let fechaVencimiento: string | null = null

      if (fechaVencimientoValue) {
        let date: Date

        // Si es un número (formato serial de Excel)
        if (typeof fechaVencimientoValue === "number") {
          console.log(`[v0] Procesando fecha como número serial: ${fechaVencimientoValue}`)
          date = new Date((fechaVencimientoValue - 25569) * 86400 * 1000)
        } else {
          const fechaStr = String(fechaVencimientoValue).trim()
          console.log(`[v0] Procesando fecha como string: "${fechaStr}"`)

          // Verificar si es formato dd/mm/aaaa o d/m/aaaa
          const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
          const match = fechaStr.match(dateRegex)

          if (match) {
            const [, day, month, year] = match
            console.log(`[v0] Fecha parseada: día=${day}, mes=${month}, año=${year}`)
            date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
          } else {
            console.log(`[v0] Formato no reconocido, intentando parseo directo`)
            date = new Date(fechaStr)
          }
        }

        // Verificar si la fecha es válida
        if (isNaN(date.getTime())) {
          console.warn(`[v0] Fecha de vencimiento inválida en fila ${index + 1}:`, fechaVencimientoValue)
          fechaVencimiento = null
        } else {
          fechaVencimiento = date.toISOString().split("T")[0]
          console.log(`[v0] Fecha de vencimiento procesada exitosamente: ${fechaVencimiento}`)
        }
      }

      let calleable = false
      const calleableValue =
        row["calleable"] ||
        row["callable"] ||
        row["Calleable"] ||
        row["Callable"] ||
        row["CALLEABLE"] ||
        row["CALLABLE"]
      console.log(`[v0] Fila ${index + 1}: Callable original =`, calleableValue, typeof calleableValue)

      if (calleableValue !== undefined && calleableValue !== null) {
        const calleableStr = String(calleableValue).toLowerCase().trim()
        console.log(`[v0] Callable procesado como string: "${calleableStr}"`)

        calleable =
          calleableStr === "sí" ||
          calleableStr === "si" ||
          calleableStr === "yes" ||
          calleableStr === "true" ||
          calleableStr === "verdadero" ||
          (calleableStr === "falso") === false || // Handle "falso" as false
          calleableStr === "1" ||
          calleableValue === true

        console.log(`[v0] Callable final: ${calleable}`)
      } else {
        console.log(`[v0] Callable value is undefined/null, defaulting to false`)
      }

      return {
        ticker: row["Ticker"],
        fecha_vencimiento: fechaVencimiento,
        legislacion: row["legislacion"] || null,
        jurisdiccion_pago: row["jurisdiccion_pago"] || null,
        lamina_minima:
          row["lamina_minima"] && !isNaN(Number(row["lamina_minima"])) ? Number(row["lamina_minima"]) : null,
        calleable: calleable,
        monto_residual:
          row["monto_residual"] && !isNaN(Number(row["monto_residual"])) ? Number(row["monto_residual"]) : null,
      }
    })

    const validData = processedData.filter((row, index) => {
      if (!row.ticker) {
        console.warn(`[v0] Omitiendo fila ${index + 1} por ticker faltante`)
        return false
      }
      return true
    })

    console.log(`[v0] Filas válidas para insertar: ${validData.length} de ${processedData.length}`)
    return validData
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setUploading(true)
      setProgress(0)
      setMessage(null)

      try {
        // Read Excel file
        setProgress(25)
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: "buffer" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelDetailsRow[]

        setProgress(50)

        // Process and validate data
        const processedData = processExcelData(jsonData)

        setProgress(60)

        const tickers = processedData.map((row) => row.ticker).filter(Boolean)
        const { data: existingTickers } = await supabase.from("ons_details").select("ticker").in("ticker", tickers)

        const existingTickerSet = new Set(existingTickers?.map((row) => row.ticker) || [])

        // Filter out existing tickers
        const newData = processedData.filter((row) => !existingTickerSet.has(row.ticker))

        console.log(`[v0] Tickers existentes encontrados: ${existingTickerSet.size}`)
        console.log(`[v0] Nuevos registros a insertar: ${newData.length} de ${processedData.length}`)

        setProgress(75)

        if (newData.length === 0) {
          setMessage({
            type: "success",
            text: `Todos los tickers ya existen en la base de datos. No se insertaron nuevos registros.`,
          })
        } else {
          const { error } = await supabase.from("ons_details").insert(newData)

          if (error) throw error

          const skippedCount = processedData.length - newData.length
          const successMessage =
            skippedCount > 0
              ? `${newData.length} nuevos detalles de ONs cargados exitosamente. ${skippedCount} tickers ya existían y fueron omitidos.`
              : `${newData.length} detalles de ONs cargados exitosamente`

          setMessage({ type: "success", text: successMessage })
        }

        setProgress(100)
        onUploadComplete()
      } catch (error) {
        console.error("Error uploading details file:", error)
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Error al procesar el archivo de detalles",
        })
      } finally {
        setUploading(false)
        setTimeout(() => setProgress(0), 2000)
      }
    },
    [supabase, onUploadComplete],
  )

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
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Cargar Detalles de ONs desde Excel
        </CardTitle>
        <CardDescription>
          Sube tu archivo Excel con los detalles de las ONs (Ticker, Fecha de Vencimiento, Legislación, etc.)
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
            <p className="text-blue-600">Suelta el archivo aquí...</p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                Arrastra tu archivo Excel de detalles aquí, o haz clic para seleccionar
              </p>
              <p className="text-sm text-gray-500">Formatos soportados: .xlsx, .xls</p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-600 mt-2">Procesando archivo de detalles...</p>
          </div>
        )}

        {message && (
          <Alert className={`mt-4 ${message.type === "error" ? "border-red-200" : "border-green-200"}`}>
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === "error" ? "text-red-700" : "text-green-700"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
