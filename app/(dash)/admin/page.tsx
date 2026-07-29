"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { InstrumentFlowsUploader } from "@/components/instrument-flows-uploader"
import { InstrumentsUploader } from "@/components/instruments-uploader"
import { RawTestUploader } from "@/components/raw-test-uploader"
import { parseFlows, parseInstruments } from "@/lib/upload-parsers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, LogOut } from "lucide-react"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (sessionStorage.getItem("admin_authenticated") === "true") {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (username === "mcastro" && password === "trolazo123") {
      setIsAuthenticated(true)
      sessionStorage.setItem("admin_authenticated", "true")
      setUsername(""); setPassword("")
    } else {
      setError("Usuario o contraseña incorrectos")
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem("admin_authenticated")
  }

  const handleUploadComplete = () => setRefreshKey(k => k + 1)

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Acceso de Administrador</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input id="username" type="text" value={username}
                  onChange={e => setUsername(e.target.value)} placeholder="Usuario" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Contraseña" required />
              </div>
              {error && (
                <Alert className="border-destructive/30">
                  <AlertDescription className="text-destructive">{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full">Iniciar Sesión</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="bg-card rounded-lg shadow-sm border p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Panel de Administración</h1>
            <p className="text-muted-foreground">Carga de datos desde Excel</p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2 bg-transparent">
            <LogOut className="h-4 w-4" />Cerrar Sesión
          </Button>
        </div>

        <InstrumentFlowsUploader onUploadComplete={handleUploadComplete} />
        <InstrumentsUploader onUploadComplete={handleUploadComplete} />

        <div className="pt-4 border-t">
          <h2 className="text-xl font-semibold text-foreground mb-1">Pruebas — Excel crudos del terminal</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Suben el archivo tal cual sale del terminal (doble encabezado) a tablas <code>_test</code>,
            sin tocar las tablas productivas. Modo &quot;solo agregar&quot;.
          </p>
        </div>

        <RawTestUploader
          title="Flujos crudos → instrument_flows_test"
          description="calendario-de-pagos.xlsx tal cual del terminal (solo Excel; el CSV redondea). Toma el interés/amortización BASE sin ajustar (columnas «(vn)», sin coeficiente CER) y descarta valuaciones con «@»."
          table="instrument_flows_test"
          parse={(grid) => {
            const { rows, skipped, discardedAt } = parseFlows(grid)
            const parts: string[] = [`${new Set(rows.map(r => r.symbol)).size} símbolos`]
            if (skipped) parts.push(`${skipped} filas omitidas (sin ticker/fecha)`)
            if (discardedAt.length) parts.push(`${discardedAt.length} descartadas por «@»`)
            return { rows: rows as unknown as Record<string, unknown>[], note: parts.join(", ") + "." }
          }}
          onUploadComplete={handleUploadComplete}
        />

        <RawTestUploader
          title="Instrumentos crudos → instruments_test"
          description="screener.xlsx tal cual del terminal (solo Excel; el CSV redondea). Mapea las columnas de «Descripción» y «Cond. de emisión»; clasifica instrument_type best-effort."
          table="instruments_test"
          parse={(grid) => {
            const { rows, skipped } = parseInstruments(grid)
            return { rows, note: skipped ? `${skipped} filas omitidas (sin ticker).` : "" }
          }}
          onUploadComplete={handleUploadComplete}
        />

      </div>
    </div>
  )
}
