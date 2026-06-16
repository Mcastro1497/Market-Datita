"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, DollarSign, BarChart3, Globe, PiggyBank, LogIn, Link2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { LbLogo } from "@/components/lb-logo"

const dashboards = [
  {
    href: "/ons",
    icon: TrendingUp,
    title: "Obligaciones Negociables",
    description: "Dashboard completo para análisis de ONs con flujos de pagos y detalles técnicos",
    cta: "Acceder a Dashboard de ONs",
    accent: "var(--lb-violet)",
    fg: "#ffffff",
    tint: "color-mix(in srgb, var(--lb-violet) 12%, transparent)",
    features: [
      { icon: BarChart3, label: "Flujos de pagos detallados" },
      { icon: TrendingUp, label: "Métricas y análisis" },
      { icon: Globe, label: "Información por emisor y legislación" },
    ],
  },
  {
    href: "/soberanos",
    icon: DollarSign,
    title: "Soberanos Hard Dollar",
    description: "Dashboard especializado para bonos soberanos denominados en dólares estadounidenses",
    cta: "Acceder a Dashboard de Soberanos",
    accent: "var(--lb-violet-accent)",
    fg: "#ffffff",
    tint: "color-mix(in srgb, var(--lb-violet-accent) 12%, transparent)",
    features: [
      { icon: DollarSign, label: "Instrumentos en USD" },
      { icon: BarChart3, label: "Detalles técnicos especializados" },
      { icon: Globe, label: "Análisis de riesgo soberano" },
    ],
  },
  {
    href: "/soberanos-ars",
    icon: PiggyBank,
    title: "Soberanos ARS",
    description: "Dashboard especializado para bonos soberanos denominados en pesos argentinos",
    cta: "Acceder a Dashboard de Soberanos ARS",
    accent: "var(--lb-violet-compl)",
    fg: "#ffffff",
    tint: "color-mix(in srgb, var(--lb-violet-compl) 12%, transparent)",
    features: [
      { icon: PiggyBank, label: "Instrumentos en ARS" },
      { icon: BarChart3, label: "Detalles técnicos especializados" },
      { icon: Globe, label: "Análisis de riesgo soberano" },
    ],
  },
  {
    href: "/dlk",
    icon: Link2,
    title: "Dólar Linked",
    description: "Bonos en pesos ajustados por tipo de cambio oficial (A3500)",
    cta: "Acceder a Dashboard de DLK",
    accent: "var(--lb-green)",
    fg: "#14331f",
    tint: "color-mix(in srgb, var(--lb-green) 22%, transparent)",
    features: [
      { icon: Link2, label: "Cotiza en ARS, valuado en USD" },
      { icon: BarChart3, label: "TIR USD calculada con FX MAE" },
      { icon: DollarSign, label: "Cobertura cambiaria implícita" },
    ],
  },
] as const

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
    <div className="min-h-screen bg-background">
      {/* Hero con degradado e identidad LB */}
      <div className="relative overflow-hidden lb-gradient text-white">
        <div className="absolute inset-0 lb-trama text-white/40" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-20">
          <div className="flex justify-between items-center gap-4">
            <LbLogo className="h-7 w-auto text-white" />
            <div className="flex gap-2">
              {loading ? (
                <div className="h-10 w-24 bg-white/20 animate-pulse rounded-md" />
              ) : user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/80 hidden sm:inline">Hola, {user.email}</span>
                  <Link href="/protected/dashboard">
                    <Button variant="secondary" className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link href="/auth/login">
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white"
                    >
                      <LogIn className="h-4 w-4" />
                      Iniciar Sesión
                    </Button>
                  </Link>
                  <Link href="/auth/sign-up">
                    <Button variant="secondary">Registrarse</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mt-16 mb-4">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Plataforma de inversiones
            </h1>
            <p className="text-lg md:text-xl text-white/85 max-w-2xl mx-auto">
              Análisis y seguimiento de instrumentos financieros. Elegí el tipo de instrumento que querés analizar.
            </p>
          </div>
        </div>
      </div>

      {/* Dashboards */}
      <div className="max-w-6xl mx-auto px-4 -mt-10 pb-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {dashboards.map((d) => {
            const Icon = d.icon
            return (
              <Link key={d.href} href={d.href} className="group">
                <Card className="h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-border/60">
                  <CardHeader className="text-center pb-4">
                    <div
                      className="mx-auto mb-4 p-4 rounded-2xl w-fit transition-transform group-hover:scale-105"
                      style={{ backgroundColor: d.tint }}
                    >
                      <Icon className="h-8 w-8" style={{ color: d.accent }} />
                    </div>
                    <CardTitle className="text-xl mb-2">{d.title}</CardTitle>
                    <CardDescription className="text-base">{d.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3 mb-6">
                      {d.features.map((f) => {
                        const FIcon = f.icon
                        return (
                          <div key={f.label} className="flex items-center gap-3 text-muted-foreground">
                            <FIcon className="h-4 w-4 shrink-0" style={{ color: d.accent }} />
                            <span className="text-sm">{f.label}</span>
                          </div>
                        )
                      })}
                    </div>
                    <Button
                      className="w-full"
                      style={{ backgroundColor: d.accent, color: d.fg }}
                    >
                      {d.cta}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="text-center mt-12 text-muted-foreground">
          <p className="text-sm">Seleccioná un dashboard para comenzar el análisis de instrumentos financieros</p>
        </div>
      </div>
    </div>
  )
}
