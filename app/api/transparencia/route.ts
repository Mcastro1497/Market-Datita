import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BASE = "https://api.bcra.gob.ar/transparencia/v1.0"

const PRODUCTOS: Record<string, string> = {
  plazos: "PlazosFijos",
  personales: "Prestamos/Personales",
  hipotecarios: "Prestamos/Hipotecarios",
  prendarios: "Prestamos/Prendarios",
  tarjetas: "TarjetasCredito",
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const producto = searchParams.get("producto") ?? ""
  const path = PRODUCTOS[producto]
  if (!path) return NextResponse.json({ error: "Producto inválido" }, { status: 400 })

  const entidades = new Set(
    (searchParams.get("entidades") ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter(Number.isFinite),
  )

  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) return NextResponse.json({ error: `BCRA ${res.status}` }, { status: 502 })
    const json = await res.json()
    let results: Record<string, unknown>[] = json?.results ?? []
    if (entidades.size > 0) {
      results = results.filter((r) => entidades.has(Number(r.codigoEntidad)))
    }
    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
