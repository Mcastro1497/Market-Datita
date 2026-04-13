"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { ExcelUploader } from "@/components/excel-uploader"
import { ONSDetailsUploader } from "@/components/ons-details-uploader"
import { SoberanosFlowsUploader } from "@/components/soberanos-flows-uploader"
import { SoberanosArsFlowsUploader } from "@/components/soberanos-ars-flows-uploader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, LogOut, Upload } from "lucide-react"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  // Check if already authenticated on page load
  useEffect(() => {
    const authStatus = sessionStorage.getItem("admin_authenticated")
    if (authStatus === "true") {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (username === "mcastro" && password === "trolazo123") {
      setIsAuthenticated(true)
      sessionStorage.setItem("admin_authenticated", "true")
      setUsername("")
      setPassword("")
    } else {
      setError("Usuario o contraseña incorrectos")
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem("admin_authenticated")
    setUsername("")
    setPassword("")
  }

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Acceso de Administrador</CardTitle>
            <CardDescription>Ingresa tus credenciales para acceder al panel de administración</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required
                />
              </div>
              {error && (
                <Alert className="border-red-200">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full">
                Iniciar Sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Panel de Administración</h1>
              <p className="text-slate-600">Gestión de datos y carga de archivos Excel</p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2 bg-transparent">
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Upload Sections */}
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2">
          {/* Flujos de ONs Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">Carga de Flujos de ONs</h2>
            </div>
            <ExcelUploader onUploadComplete={handleUploadComplete} />
          </div>

          {/* Detalles de ONs Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-semibold text-slate-900">Carga de Detalles de ONs</h2>
            </div>
            <ONSDetailsUploader onUploadComplete={handleUploadComplete} />
          </div>

          {/* Flujos de Soberanos Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-purple-600" />
              <h2 className="text-xl font-semibold text-slate-900">Carga de Flujos de Soberanos</h2>
            </div>
            <SoberanosFlowsUploader onUploadComplete={handleUploadComplete} />
          </div>

          {/* Flujos de Soberanos ARS Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-orange-600" />
              <h2 className="text-xl font-semibold text-slate-900">Carga de Flujos de Soberanos ARS</h2>
            </div>
            <SoberanosArsFlowsUploader onUploadComplete={handleUploadComplete} />
          </div>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instrucciones de Uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Carga de Flujos de ONs:</h3>
              <p className="text-slate-600 text-sm">
                Sube archivos Excel con las columnas: Fecha de pago, Emisor, Ticker, Interés, Amortización, Total, Mon.
                pago, Mon. denom. Base, Días, Cupón, Valor residual.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Carga de Detalles de ONs:</h3>
              <p className="text-slate-600 text-sm">
                Sube archivos Excel con las columnas: Ticker, Fecha de Vencimiento, Legislación, Jurisdicción de Pago,
                Lámina Mínima, Calleable, Monto Residual.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Carga de Flujos de Soberanos:</h3>
              <p className="text-slate-600 text-sm">
                Sube archivos Excel con las columnas: Fecha de pago, Emisor, Ticker, Interés, Amortización, Total, Mon.
                pago, Mon. denom. Base, Días, Cupón, Valor residual (mismo formato que ONs).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Carga de Flujos de Soberanos ARS:</h3>
              <p className="text-slate-600 text-sm">
                Sube archivos Excel con las columnas: Fecha de pago, Emisor, Ticker, Interés, Amortización, Total, Mon.
                pago, Mon. denom. Base, Días, Cupón, Valor residual (denominados en pesos argentinos).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
