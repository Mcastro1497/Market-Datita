"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { readGrid } from "@/lib/upload-parsers"

interface Props {
  title: string
  description: string
  table: string
  /** Parsea la grilla cruda y devuelve filas a insertar + un texto de resumen. */
  parse: (grid: unknown[][]) => { rows: Record<string, unknown>[]; note: string }
  onUploadComplete: () => void
}

const BATCH = 500

export function RawTestUploader({ title, description, table, parse, onUploadComplete }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const supabase = createClient()

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploading(true); setProgress(10); setMessage(null)
    try {
      const grid = await readGrid(file)
      setProgress(35)
      const { rows, note } = parse(grid)
      if (rows.length === 0) throw new Error("No se encontraron filas válidas en el archivo.")

      setProgress(45)
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from(table).insert(rows.slice(i, i + BATCH))
        if (error) throw error
        setProgress(45 + Math.round(((i + BATCH) / rows.length) * 50))
      }
      setProgress(100)
      setMessage({ type: "success", text: `${rows.length} filas cargadas en ${table}. ${note}` })
      onUploadComplete()
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Error al procesar el archivo" })
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }, [supabase, table, parse, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
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
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
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
              <p className="text-muted-foreground mb-2">Arrastrá el Excel crudo del terminal, o hacé clic para seleccionar</p>
              <p className="text-sm text-muted-foreground">Formatos: .csv, .xlsx, .xls</p>
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
