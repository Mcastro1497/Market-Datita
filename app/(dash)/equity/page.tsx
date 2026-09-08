"use client"

/**
 * Equity — cotizaciones de acciones argentinas y CEDEARs (BYMA, 24hs, ARS).
 *
 * Capa de presentación solamente. El fetch, el polling de 30s, el tipo Eq y los
 * paneles del usuario en localStorage quedan como estaban.
 *
 * CRITERIO DE DISEÑO
 * Es una pantalla de cotizaciones: lo que importa es cuántos tickers entran de
 * un vistazo y qué tan rápido se compara una fila con otra. De ahí salen las
 * decisiones que se ven raras leídas sueltas: una sola superficie sin cards
 * anidadas, filas de 26px, divisores de medio píxel, y toda la barra de control
 * en una línea para que el primer dato aparezca lo más arriba posible.
 *
 * Las tres solapas viejas (Mercado / Paneles / Mis paneles) se abren a cuatro
 * planas —Mercado, Acciones, CEDEARs, Mis paneles— porque Paneles adentro tenía
 * a su vez Acciones y CEDEARs, y ese segundo nivel de pestañas era justamente
 * uno de los anidamientos a sacar.
 */

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Info, Loader2, Plus, Search, Trash2, X } from "lucide-react"

import { PANEL_LIDER, REGIONES_CEDEAR, SECTORES_CEDEAR } from "@/lib/paneles-default"

const STORAGE = "lb-equity-paneles-v1"

/**
 * La app usa Plus Jakarta Sans, que es redondeada y no acompaña una grilla de
 * números. Acá se pisa sólo para esta pantalla; el resto de la app no se toca.
 */
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

type Eq = {
  ticker: string
  tipo: "ACCION" | "CEDEAR" | null
  last: number | null
  closing_price: number | null
  var_diaria: number | null
  ts: string | null
}
type Panel = { id: string; name: string; tickers: string[] }
type OrdenKey = "ticker" | "tipo" | "last" | "closing_price" | "var_diaria"
type Orden = { k: OrdenKey; dir: "asc" | "desc" }

// ── Formato ──────────────────────────────────────────────────────────────────
// Siempre dos decimales. Antes convivían "849", "41,11" y "2.812,5" en la misma
// columna y la coma decimal caía en un lugar distinto en cada fila.
const NF = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (v: number | null | undefined) => (v == null ? "—" : NF.format(v))

function Variacion({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="text-muted-foreground">—</span>
  const pct = `${NF.format(Math.abs(v) * 100)}%`
  if (Math.abs(v) < 0.00005) {
    return <span className="tabular-nums text-muted-foreground">— {pct}</span>
  }
  const sube = v > 0
  const token = sube ? "var(--success)" : "var(--destructive)"
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-[1px] tabular-nums"
      style={{ background: `color-mix(in srgb, ${token} 14%, transparent)`, color: token }}
    >
      <span aria-hidden>{sube ? "▲" : "▼"}</span>
      <span className="sr-only">{sube ? "sube" : "baja"}</span>
      {pct}
    </span>
  )
}

/**
 * Abierto / cerrado sale de la frescura del propio dato y no sólo del reloj: si
 * estamos en horario de rueda pero el último tick tiene media hora, lo honesto
 * es decir que no hay datos, no que el mercado está abierto. Un feriado se ve
 * como "cerrado" por ausencia de datos — no hay calendario en el cliente.
 */
function EstadoMercado({ ultimo }: { ultimo: string | null }) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // Hora Y día se leen de la misma zona horaria. Con getUTCDay() el día salía de
  // UTC contra una hora argentina, y entre las 21 y la medianoche local eso ya
  // es el día siguiente en UTC: un viernes a la noche daba sábado.
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(new Date(ahora))
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? 0)
  const dia = partes.find((p) => p.type === "weekday")?.value ?? ""
  const enRueda = !["Sat", "Sun"].includes(dia) && h >= 11 && h < 17

  const edadMin = ultimo ? (ahora - new Date(ultimo).getTime()) / 60000 : Infinity
  const estado =
    edadMin < 5 ? { txt: "Mercado abierto", color: "var(--success)" }
    : enRueda ? { txt: "Sin datos", color: "var(--destructive)" }
    : { txt: "Mercado cerrado", color: "var(--muted-foreground)" }

  const reloj = ultimo
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date(ultimo))
    : null

  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: estado.color }} />
      <span style={{ color: estado.color }}>{estado.txt}</span>
      {reloj && <span className="tabular-nums">· actualizado {reloj}</span>}
    </span>
  )
}

// ── Tabla ────────────────────────────────────────────────────────────────────
function TablaCotizaciones({
  filas, orden, setOrden, mostrarTipo = false, onQuitar,
}: {
  filas: Eq[]
  orden: Orden
  setOrden: (o: Orden) => void
  mostrarTipo?: boolean
  onQuitar?: (t: string) => void
}) {
  const ordenar = (k: OrdenKey) =>
    setOrden({ k, dir: orden.k === k && orden.dir === "asc" ? "desc" : "asc" })

  const Th = ({ k, children, alDerecha = true }: { k: OrdenKey; children: React.ReactNode; alDerecha?: boolean }) => (
    <th className={`px-2 ${alDerecha ? "text-right" : "text-left"}`}>
      <button
        onClick={() => ordenar(k)}
        className={`inline-flex items-center gap-1 py-1.5 text-[11px] font-medium uppercase tracking-wide transition hover:text-foreground ${
          orden.k === k ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {children}
        <span className="text-[9px] opacity-70">{orden.k === k ? (orden.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  )

  if (!filas.length) {
    return (
      <p className="py-12 text-center text-[13px] text-muted-foreground">
        Ningún instrumento de esta selección operó hoy.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead className="sticky top-0 z-10 bg-background">
          <tr style={{ borderBottomWidth: "0.5px" }} className="border-border">
            <Th k="ticker" alDerecha={false}>Ticker</Th>
            {mostrarTipo && <Th k="tipo" alDerecha={false}>Tipo</Th>}
            <Th k="last">Último</Th>
            <Th k="closing_price">Cierre ant.</Th>
            <Th k="var_diaria">Var. diaria</Th>
            {onQuitar && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {filas.map((r) => (
            <tr
              key={r.ticker}
              className="border-border last:border-0 hover:bg-muted/40"
              style={{ borderBottomWidth: "0.5px" }}
            >
              <td className="px-2 py-[5px] font-medium leading-4">{r.ticker}</td>
              {mostrarTipo && (
                <td className="px-2 py-[5px] leading-4 text-muted-foreground">
                  {r.tipo === "ACCION" ? "Acción" : r.tipo === "CEDEAR" ? "CEDEAR" : "—"}
                </td>
              )}
              <td className="px-2 py-[5px] text-right leading-4 text-foreground">{num(r.last)}</td>
              <td className="px-2 py-[5px] text-right leading-4 text-muted-foreground">{num(r.closing_price)}</td>
              <td className="px-2 py-[5px] text-right leading-4"><Variacion v={r.var_diaria} /></td>
              {onQuitar && (
                <td className="px-1 py-[5px] text-right">
                  <button
                    onClick={() => onQuitar(r.ticker)}
                    aria-label={`Quitar ${r.ticker}`}
                    className="text-muted-foreground transition hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ordenarFilas(filas: Eq[], orden: Orden) {
  const signo = orden.dir === "asc" ? 1 : -1
  return [...filas].sort((a, b) => {
    if (orden.k === "ticker") return signo * a.ticker.localeCompare(b.ticker)
    if (orden.k === "tipo") return signo * String(a.tipo).localeCompare(String(b.tipo))
    const va = a[orden.k], vb = b[orden.k]
    // Los que no operaron van siempre al final: ordenados como cero se colaban
    // arriba de todo en la variación negativa y parecían la mayor caída.
    if (va == null) return 1
    if (vb == null) return -1
    return signo * (va - vb)
  })
}

const SELECT_CLS =
  "h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground " +
  "outline-none transition focus-visible:ring-2 focus-visible:ring-ring"

// ── Pantalla ─────────────────────────────────────────────────────────────────
type Solapa = "mercado" | "acciones" | "cedears" | "mios"

export default function EquityPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Eq[]>([])
  const [loading, setLoading] = useState(true)
  const [panels, setPanels] = useState<Panel[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE)
      if (raw) setPanels(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem(STORAGE, JSON.stringify(panels)) } catch {}
    }
  }, [panels, hydrated])

  // fetch + refresh cada 30s
  useEffect(() => {
    let cancel = false
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("acciones_cedears")
          .select("ticker, tipo, last, closing_price, var_diaria, ts")
          .order("ticker")
        if (!cancel && !error && data) setRows(data as Eq[])
      } catch {
        /* sin env */
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 30000)
    return () => { cancel = true; clearInterval(id) }
  }, [supabase])

  const [solapa, setSolapa] = useState<Solapa>("mercado")
  const [orden, setOrden] = useState<Orden>({ k: "ticker", dir: "asc" })
  const [busqueda, setBusqueda] = useState("")
  const [tipoMercado, setTipoMercado] = useState<"all" | "ACCION" | "CEDEAR">("all")
  const [panelAcc, setPanelAcc] = useState<"all" | "lider" | "general">("lider")
  const [sector, setSector] = useState("all")
  const [region, setRegion] = useState("all")
  const [panelId, setPanelId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const acciones = useMemo(() => rows.filter((r) => r.tipo === "ACCION"), [rows])
  const cedears = useMemo(() => rows.filter((r) => r.tipo === "CEDEAR"), [rows])
  const byTicker = useMemo(() => new Map(rows.map((r) => [r.ticker, r])), [rows])
  const ultimoTs = useMemo(
    () => rows.reduce<string | null>((max, r) => (r.ts && (!max || r.ts > max) ? r.ts : max), null),
    [rows],
  )

  // Índice inverso de la clasificación, que está guardada como grupo -> tickers.
  const indice = useMemo(() => {
    const inv = (mapa: Record<string, string[]>) => {
      const m = new Map<string, string>()
      for (const [grupo, ts] of Object.entries(mapa)) for (const t of ts) m.set(t, grupo)
      return m
    }
    return { sector: inv(SECTORES_CEDEAR), region: inv(REGIONES_CEDEAR) }
  }, [])

  const panelActivo = panels.find((p) => p.id === panelId) ?? panels[0] ?? null

  const filas = useMemo(() => {
    const q = busqueda.trim().toUpperCase()
    let base: Eq[]
    if (solapa === "mercado") {
      base = tipoMercado === "all" ? rows : rows.filter((r) => r.tipo === tipoMercado)
    } else if (solapa === "acciones") {
      const lider = new Set<string>(PANEL_LIDER as readonly string[])
      base = panelAcc === "all" ? acciones
        : panelAcc === "lider" ? acciones.filter((r) => lider.has(r.ticker))
        : acciones.filter((r) => !lider.has(r.ticker))
    } else if (solapa === "cedears") {
      base = cedears.filter((r) => {
        const s = indice.sector.get(r.ticker) ?? "Otros"
        const g = indice.region.get(r.ticker) ?? "Estados Unidos"
        return (sector === "all" || s === sector) && (region === "all" || g === region)
      })
    } else {
      base = (panelActivo?.tickers ?? []).map((t) => byTicker.get(t)).filter(Boolean) as Eq[]
    }
    if (q) base = base.filter((r) => r.ticker.toUpperCase().includes(q))
    return ordenarFilas(base, orden)
  }, [solapa, rows, acciones, cedears, tipoMercado, panelAcc, sector, region,
      panelActivo, byTicker, busqueda, orden, indice])

  const nuevoPanel = () => {
    const id = `${Date.now()}`
    setPanels((p) => [...p, { id, name: `Panel ${p.length + 1}`, tickers: [] }])
    setPanelId(id)
  }
  const addTicker = (t: string) =>
    setPanels((p) => p.map((x) => (x.id === panelActivo?.id && !x.tickers.includes(t)
      ? { ...x, tickers: [...x.tickers, t] } : x)))
  const removeTicker = (t: string) =>
    setPanels((p) => p.map((x) => (x.id === panelActivo?.id
      ? { ...x, tickers: x.tickers.filter((y) => y !== t) } : x)))

  const SOLAPAS: { k: Solapa; label: string; n?: number }[] = [
    { k: "mercado", label: "Mercado", n: rows.length },
    { k: "acciones", label: "Acciones", n: acciones.length },
    { k: "cedears", label: "CEDEARs", n: cedears.length },
    { k: "mios", label: "Mis paneles", n: panels.length },
  ]

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: FUENTE }}>
      <div className="mx-auto max-w-5xl px-4 py-5">

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Equity</h1>
          <span className="text-[13px] text-muted-foreground">BYMA 24hs ARS</span>
          <div className="ml-auto"><EstadoMercado ultimo={ultimoTs} /></div>
        </div>

        {/* Barra de control: una sola línea. Cada solapa trae sus propios filtros
            porque sector y región sólo existen para CEDEARs. */}
        <div
          className="flex flex-wrap items-center gap-2 py-2"
          style={{ borderTopWidth: "0.5px", borderBottomWidth: "0.5px" }}
        >
          <div className="flex items-center gap-0.5">
            {SOLAPAS.map((s) => (
              <button
                key={s.k}
                onClick={() => setSolapa(s.k)}
                className={`rounded px-2.5 py-1 text-[13px] font-medium transition ${
                  solapa === s.k ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
                {s.n !== undefined && <span className="ml-1 tabular-nums opacity-60">{s.n}</span>}
              </button>
            ))}
          </div>

          {solapa === "mercado" && (
            <select className={SELECT_CLS} value={tipoMercado}
              onChange={(e) => setTipoMercado(e.target.value as any)} aria-label="Tipo">
              <option value="all">Todos los tipos</option>
              <option value="ACCION">Acciones</option>
              <option value="CEDEAR">CEDEARs</option>
            </select>
          )}

          {solapa === "acciones" && (
            <select className={SELECT_CLS} value={panelAcc}
              onChange={(e) => setPanelAcc(e.target.value as any)} aria-label="Panel">
              <option value="lider">Panel líder</option>
              <option value="general">Panel general</option>
              <option value="all">Todas las acciones</option>
            </select>
          )}

          {solapa === "cedears" && (
            <>
              <select className={SELECT_CLS} value={sector}
                onChange={(e) => setSector(e.target.value)} aria-label="Sector">
                <option value="all">Todos los sectores</option>
                {Object.keys(SECTORES_CEDEAR).map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="Otros">Otros</option>
              </select>
              <select className={SELECT_CLS} value={region}
                onChange={(e) => setRegion(e.target.value)} aria-label="Región">
                <option value="all">Todas las regiones</option>
                {Object.keys(REGIONES_CEDEAR).map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="Estados Unidos">Estados Unidos</option>
              </select>
              <span
                title="La clasificación de CEDEARs se mantiene a mano. Lo que todavía no está cargado aparece bajo «Otros»."
                className="text-muted-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </>
          )}

          {solapa === "mios" && (
            <>
              <select className={SELECT_CLS} value={panelActivo?.id ?? ""}
                onChange={(e) => setPanelId(e.target.value)} aria-label="Panel"
                disabled={!panels.length}>
                {panels.length
                  ? panels.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.tickers.length})</option>)
                  : <option value="">Sin paneles</option>}
              </select>
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={nuevoPanel}>
                <Plus className="h-3.5 w-3.5" /> Nuevo
              </Button>
              {panelActivo && (
                <>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1">
                        <Plus className="h-3.5 w-3.5" /> Ticker
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar acción o CEDEAR..." />
                        <CommandList>
                          <CommandEmpty>Sin resultados.</CommandEmpty>
                          <CommandGroup>
                            {rows.filter((r) => !panelActivo.tickers.includes(r.ticker)).map((r) => (
                              <CommandItem key={r.ticker} value={r.ticker}
                                onSelect={() => { addTicker(r.ticker); setPickerOpen(false) }}>
                                <span className="font-medium">{r.ticker}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{r.tipo}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="ghost" size="sm"
                    className="h-8 gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setPanels((p) => p.filter((x) => x.id !== panelActivo.id))
                      setPanelId(null)
                    }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </>
          )}

          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ticker"
              className="h-8 w-32 pl-7 text-[13px]"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : solapa === "mios" && !panelActivo ? (
          <p className="py-16 text-center text-[13px] text-muted-foreground">
            Todavía no armaste ningún panel. Creá uno con «Nuevo».
          </p>
        ) : (
          <>
            <TablaCotizaciones
              filas={filas}
              orden={orden}
              setOrden={setOrden}
              mostrarTipo={solapa === "mercado" || solapa === "mios"}
              onQuitar={solapa === "mios" ? removeTicker : undefined}
            />
            <p className="py-2 text-[12px] text-muted-foreground">
              {filas.length} de {solapa === "mercado" ? rows.length
                : solapa === "acciones" ? acciones.length
                : solapa === "cedears" ? cedears.length
                : panelActivo?.tickers.length ?? 0} instrumentos
            </p>
          </>
        )}
      </div>
    </div>
  )
}
