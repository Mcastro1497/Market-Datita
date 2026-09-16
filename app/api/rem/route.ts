/**
 * Expectativas de inflación del REM más el IPC ya publicado, para comparar con
 * los breakevens. Las tablas `rem` y `series` las llena marketweb (rem_sync.py
 * y series_sync.py); acá sólo se leen.
 *
 * Va por el servidor y no desde el browser porque el resto del sitio nunca leyó
 * estas tablas y no está garantizado que el rol anon las vea. Igual que en
 * /api/feriados: anon si alcanza, service role si está configurado.
 */
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""

const mes = (fecha: string) => String(fecha).slice(0, 7)

export async function GET() {
  if (!URL || !KEY) return NextResponse.json({ configurado: false })
  const db = createClient(URL, KEY, { auth: { persistSession: false } })
  try {
    const ultimo = await db.from("rem").select("fecha_rem").eq("variable", "ipc")
      .order("fecha_rem", { ascending: false }).limit(1).maybeSingle()
    if (ultimo.error) throw ultimo.error
    const fechaRem: string | null = ultimo.data?.fecha_rem ?? null

    const [filas, observado] = await Promise.all([
      fechaRem
        ? db.from("rem").select("tipo,fecha_ref,mediana").eq("variable", "ipc").eq("fecha_rem", fechaRem)
        : Promise.resolve({ data: [], error: null }),
      // Catorce meses: el año en curso entero, para que la senda calibre bien
      // la variación anual del REM contra lo que ya se publicó.
      db.from("series").select("fecha,valor").eq("serie", "ipc_mensual")
        .order("fecha", { ascending: false }).limit(14),
    ])
    if (filas.error) throw filas.error
    if (observado.error) throw observado.error

    const mensual = (filas.data ?? [])
      .filter((r: any) => r.tipo === "mensual" && r.fecha_ref && r.mediana != null)
      .map((r: any) => ({ mes: mes(r.fecha_ref), valor: Number(r.mediana) }))
      .sort((a: any, b: any) => a.mes.localeCompare(b.mes))
    const anual = (filas.data ?? [])
      .filter((r: any) => r.tipo === "anual" && r.fecha_ref && r.mediana != null)
      .map((r: any) => ({ anio: Number(String(r.fecha_ref).slice(0, 4)), valor: Number(r.mediana) }))
      .sort((a: any, b: any) => a.anio - b.anio)
    const obs = (observado.data ?? [])
      .map((r: any) => ({ mes: mes(r.fecha), valor: Number(r.valor) }))
      .sort((a: any, b: any) => a.mes.localeCompare(b.mes))

    return NextResponse.json({ configurado: true, fechaRem, mensual, anual, observado: obs })
  } catch (e) {
    return NextResponse.json({ configurado: false, error: String(e) }, { status: 500 })
  }
}
