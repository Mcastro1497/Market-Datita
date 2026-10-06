"use client"

import { BonosDashboard } from "@/components/bonos-dashboard"

export default function ProvincialesDashboard() {
  return (
    <BonosDashboard
      tipo="SUBSOB"
      titulo="Dashboard de Provinciales"
      subtitulo="Bonos de provincias y municipios: hard dollar, TAMAR, CER y más"
      unidad="provinciales"
      clave="provinciales"
    />
  )
}
