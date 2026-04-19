"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, DollarSign, BarChart3, Globe, PiggyBank, LogIn, Link2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div></div>
          <div className="flex gap-2">
            {loading ? (
              <div className="h-10 w-24 bg-slate-200 animate-pulse rounded"></div>
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">Hola, {user.email}</span>
                <Link href="/protected/dashboard">
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <LogIn className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/auth/login">
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <LogIn className="h-4 w-4" />
                    Iniciar Sesión
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button>Registrarse</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Dashboard Financiero</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Análisis y seguimiento de instrumentos financieros. Selecciona el tipo de instrumento que deseas analizar.
          </p>
        </div>

        {/* Dashboard Options */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {/* ONs Dashboard Card */}
          <Link href="/ons" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-xl hover:scale-105 border-2 hover:border-blue-200 cursor-pointer">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-blue-100 rounded-full w-fit group-hover:bg-blue-200 transition-colors">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 mb-2">Obligaciones Negociables</CardTitle>
                <CardDescription className="text-base">
                  Dashboard completo para análisis de ONs con flujos de pagos y detalles técnicos
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-slate-600">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Flujos de pagos detallados</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Métricas y análisis</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Información por emisor y legislación</span>
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">Acceder a Dashboard de ONs</Button>
              </CardContent>
            </Card>
          </Link>

          {/* Soberanos HD Dashboard Card */}
          <Link href="/soberanos" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-xl hover:scale-105 border-2 hover:border-green-200 cursor-pointer">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-green-100 rounded-full w-fit group-hover:bg-green-200 transition-colors">
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 mb-2">Soberanos Hard Dollar</CardTitle>
                <CardDescription className="text-base">
                  Dashboard especializado para bonos soberanos denominados en dólares estadounidenses
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-slate-600">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Instrumentos en USD</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <BarChart3 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Detalles técnicos especializados</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Globe className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Análisis de riesgo soberano</span>
                  </div>
                </div>
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  Acceder a Dashboard de Soberanos
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Soberanos ARS Dashboard Card */}
          <Link href="/soberanos-ars" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-xl hover:scale-105 border-2 hover:border-orange-200 cursor-pointer">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-orange-100 rounded-full w-fit group-hover:bg-orange-200 transition-colors">
                  <PiggyBank className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 mb-2">Soberanos ARS</CardTitle>
                <CardDescription className="text-base">
                  Dashboard especializado para bonos soberanos denominados en pesos argentinos
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-slate-600">
                    <PiggyBank className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Instrumentos en ARS</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Detalles técnicos especializados</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Globe className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Análisis de riesgo soberano</span>
                  </div>
                </div>
                <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                  Acceder a Dashboard de Soberanos ARS
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Dólar Linked Dashboard Card */}
          <Link href="/dlk" className="group">
            <Card className="h-full transition-all duration-300 hover:shadow-xl hover:scale-105 border-2 hover:border-purple-200 cursor-pointer">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-purple-100 rounded-full w-fit group-hover:bg-purple-200 transition-colors">
                  <Link2 className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle className="text-2xl text-slate-900 mb-2">Dólar Linked</CardTitle>
                <CardDescription className="text-base">
                  Bonos en pesos ajustados por tipo de cambio oficial (A3500)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Link2 className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Cotiza en ARS, valuado en USD</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">TIR USD calculada con FX MAE</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <DollarSign className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Cobertura cambiaria implícita</span>
                  </div>
                </div>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  Acceder a Dashboard de DLK
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-12 text-slate-500">
          <p className="text-sm">Selecciona un dashboard para comenzar el análisis de instrumentos financieros</p>
        </div>
      </div>
    </div>
  )
}
