import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BASE = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias"
const MAX_LIMIT = 3000 // tope que impone el BCRA por request

type Punto = { fecha: string; valor: number }

async function fetchSerie(id: number, desde?: string, hasta?: string): Promise<Punto[]> {
  const qs = new URLSearchParams({ Limit: String(MAX_LIMIT) })
  if (desde) qs.set("Desde", desde)
  if (hasta) qs.set("Hasta", hasta)
  const res = await fetch(`${BASE}/${id}?${qs.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) return []
  const json = await res.json()
  const detalle: Punto[] = json?.results?.[0]?.detalle ?? []
  // El BCRA devuelve descendente; lo ordenamos ascendente para graficar.
  return detalle
    .filter((d) => d && d.fecha && Number.isFinite(d.valor))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const idsRaw = searchParams.get("ids") ?? ""
  const desde = searchParams.get("desde") ?? undefined
  const hasta = searchParams.get("hasta") ?? undefined
  const ids = idsRaw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))

  if (ids.length === 0) {
    return NextResponse.json({ error: "Faltan ids" }, { status: 400 })
  }

  try {
    const pares = await Promise.all(
      ids.map(async (id) => [id, await fetchSerie(id, desde, hasta)] as const),
    )
    const series: Record<string, Punto[]> = {}
    for (const [id, det] of pares) series[id] = det
    return NextResponse.json({ series })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
