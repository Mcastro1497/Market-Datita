import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Tabla compartida con el resto de la plataforma (la usa también el script de DLK).
const TABLE = "holidays"
const COL = "holiday_date"
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

/** Contraseña para editar feriados. Configurable por env, con default. */
function passwordOk(req: Request): boolean {
  const esperada = process.env.FERIADOS_PASSWORD ?? "trolazo123"
  return req.headers.get("x-feriados-password") === esperada
}

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_KEY ?? ""

/** Cliente de lectura (anon) y de escritura (service role si está, para saltar RLS). */
function getClient(write = false): SupabaseClient | null {
  const key = write ? SERVICE || ANON : ANON || SERVICE
  if (!URL || !key) return null
  return createClient(URL, key, { auth: { persistSession: false } })
}

export async function GET() {
  const db = getClient()
  if (!db) return NextResponse.json({ feriados: [], configurado: false })
  try {
    const { data, error } = await db.from(TABLE).select(COL)
    if (error) throw error
    const feriados = Array.from(
      new Set((data ?? []).map((r: Record<string, unknown>) => String(r[COL]).slice(0, 10))),
    ).sort()
    return NextResponse.json({ feriados, configurado: true })
  } catch (e) {
    return NextResponse.json(
      { feriados: [], configurado: false, error: String(e) },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  if (!passwordOk(req)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 })
  }
  const db = getClient(true)
  if (!db) return NextResponse.json({ error: "Base no configurada" }, { status: 503 })
  const { date } = await req.json().catch(() => ({}))
  if (typeof date !== "string" || !ISO_RE.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
  }
  const { error } = await db.from(TABLE).insert({ [COL]: date })
  // 23505 = unique violation: el feriado ya existía, lo tratamos como OK.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  if (!passwordOk(req)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 })
  }
  const db = getClient(true)
  if (!db) return NextResponse.json({ error: "Base no configurada" }, { status: 503 })
  const { date } = await req.json().catch(() => ({}))
  if (typeof date !== "string" || !ISO_RE.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
  }
  const { error } = await db.from(TABLE).delete().eq(COL, date)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
