"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import * as XLSX from "xlsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { ExcelSoberanoRow } from "@/lib/types"

interface SoberanosFlowsUploaderProps {
  onUploadComplete: () => void
}

export function SoberanosFlowsUploader({ onUploadComplete }: SoberanosFlowsUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createClient()

  const processExcelData = async (data: ExcelSoberanoRow[]) => {
    console.log("[v0] Procesando", data.length, "filas del Excel de Soberanos")

    if (data.length > 0) {
      console.log("[v0] Columnas disponibles en Excel:", Object.keys(data[0]))
    }

    const tickers = data.map((row) => row["Ticker"]).filter(Boolean)
    const { data: existingTickers } = await supabase.from("soberanos_flows").select("ticker").in("ticker", tickers)

    const existingTickerSet = new Set(existingTickers?.map((item) => item.ticker) || [])
    console.log("[v0] Tickers existentes encontrados:", Array.from(existingTickerSet))

    const processedData = data.map((row, index) => {
      const fechaValue = row["Fecha de pago"] || row["Fecha"] || row["fecha_pago"] || row["fecha"] || row["Date"]
      console.log(`[v0] Fila ${index + 1}: Fecha original =`, fechaValue, typeof fechaValue)

      let fechaPago: string | null = null

      if (fechaValue) {
        let date: Date

        // Si es un número (formato serial de Excel)
        if (typeof fechaValue === "number") {
          console.log(`[v0] Procesando fecha como número serial: ${fechaValue}`)
          // Excel usa 1900-01-01 como día 1, pero JavaScript usa 1970-01-01
          date = new Date((fechaValue - 25569) * 86400 * 1000)
        } else {
          const fechaStr = String(fechaValue).trim()
          console.log(`[v0] Procesando fecha como string: "${fechaStr}"`)

          const dateRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
          const match = fechaStr.match(dateRegex)

          if (match) {
            const [, day, month, year] = match
            console.log(`[v0] Fecha parseada: día=${day}, mes=${month}, año=${year}`)
            // Crear fecha en formato ISO (aaaa-mm-dd) para evitar problemas de zona horaria
            date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
          } else {
            console.log(`[v0] Formato no reconocido, intentando parseo directo`)
            // Fallback: intentar parsearlo directamente
            date = new Date(fechaStr)
          }
        }

        // Verificar si la fecha es válida
        if (isNaN(date.getTime())) {
          console.warn(`[v0] Fecha inválida en fila ${index + 1}:`, fechaValue)
          fechaPago = null
        } else {
          fechaPago = date.toISOString().split("T")[0]
          console.log(`[v0] Fecha procesada exitosamente: ${fechaPago}`)
        }
      } else {
        console.warn(`[v0] Fecha vacía en fila ${index + 1}`)
      }

      let cuponValue = 0
      if (row["Cupón"] && !isNaN(Number(row["Cupón"]))) {
        cuponValue = Number(row["Cupón"])
      }

      return {
        fecha_pago: fechaPago,
        emisor: row["Emisor"],
        ticker: row["Ticker"],
        interes: row["Interés"] && !isNaN(Number(row["Interés"])) ? Number(row["Interés"]) : null,
        amortizacion: row["Amortización"] && !isNaN(Number(row["Amortización"])) ? Number(row["Amortización"]) : null,
        total: row["Total"] && !isNaN(Number(row["Total"])) ? Number(row["Total"]) : null,
        moneda_pago: row["Mon. pago"] || "USD",
        moneda_denominacion: row["Mon. denom. Base"] || "USD",
        dias: row["Días"] && !isNaN(Number(row["Días"])) ? Number(row["Días"]) : null,
        cupon: cuponValue,
        valor_residual:
          row["Valor residual"] && !isNaN(Number(row["Valor residual"])) ? Number(row["Valor residual"]) : null,
      }
    })

    const validData = processedData.filter((row, index) => {
      if (row.ticker && existingTickerSet.has(row.ticker)) {
        console.warn(`[v0] Omitiendo fila ${index + 1} - ticker ${row.ticker} ya existe`)
        return false
      }

      if (!row.fecha_pago) {
        console.warn(`[v0] Omitiendo fila ${index + 1} por fecha inválida`)
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelSoberanoRow[]

        setProgress(50)

        // Process and validate data
        const processedData = await processExcelData(jsonData)

        setProgress(75)

        if (processedData.length > 0) {
          const { error } = await supabase.from("soberanos_flows").insert(processedData)
          if (error) throw error
        }

        setProgress(100)
        setMessage({
          type: "success",
          text: `${processedData.length} registros nuevos de Soberanos cargados exitosamente`,
        })
        onUploadComplete()
      } catch (error) {
        console.error("Error uploading file:", error)
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Error al procesar el archivo",
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
          Cargar Flujos de Soberanos desde Excel
        </CardTitle>
        <CardDescription>Sube tu archivo Excel con los datos de flujos de Soberanos Hard Dollar</CardDescription>
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
              <p className="text-gray-600 mb-2">Arrastra tu archivo Excel aquí, o haz clic para seleccionar</p>
              <p className="text-sm text-gray-500">Formatos soportados: .xlsx, .xls</p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-600 mt-2">Procesando archivo...</p>
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
