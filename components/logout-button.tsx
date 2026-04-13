"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2 bg-transparent">
      <LogOut className="h-4 w-4" />
      Cerrar Sesión
    </Button>
  )
}
