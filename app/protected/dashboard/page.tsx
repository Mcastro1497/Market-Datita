import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { LogoutButton } from "@/components/logout-button"

export default async function ProtectedDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Financiero</h1>
            <p className="text-muted-foreground">Bienvenido, {profile?.full_name || user.email}</p>
          </div>
          <LogoutButton />
        </div>

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Cuenta</CardTitle>
            <CardDescription>Detalles de tu perfil y suscripción</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Email:</span>
              <span>{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Plan:</span>
              <span className="capitalize">{profile?.subscription_status || "free"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Miembro desde:</span>
              <span>{new Date(user.created_at).toLocaleDateString("es-ES")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Obligaciones Negociables</CardTitle>
              <CardDescription>Analiza y gestiona tus ONs favoritas</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/ons">
                <Button className="w-full">Ver ONs</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Soberanos ARS</CardTitle>
              <CardDescription>Información detallada de bonos soberanos</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/soberanos-ars">
                <Button className="w-full">Ver Soberanos</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Free Plan Notice */}
        {profile?.subscription_status === "free" && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800">Plan Gratuito</CardTitle>
              <CardDescription className="text-amber-700">
                Estás usando el plan gratuito con funcionalidades limitadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 bg-transparent">
                Actualizar a Premium
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
