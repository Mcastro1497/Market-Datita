"use client"

import { BonosDashboard } from "@/components/bonos-dashboard"

export default function ONSDashboard() {
  return (
    <BonosDashboard
      tipo="ON"
      titulo="Dashboard de ONs"
      subtitulo="Análisis y seguimiento de flujos de Obligaciones Negociables"
      unidad="ONs"
      clave="ons"
    />
  )
}
