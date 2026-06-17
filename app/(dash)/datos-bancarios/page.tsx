"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Landmark, Loader2, ArrowUpDown, Search } from "lucide-react"

// ── Bancos más grandes de Argentina (codigoEntidad → nombre corto) ──
const BANCOS: Record<number, string> = {
  11: "Nación",
  7: "Galicia",
  72: "Santander",
  14: "Provincia",
  17: "BBVA",
  285: "Macro",
  191: "Credicoop",
  15: "ICBC",
  29: "Ciudad",
  34: "Patagonia",
  27: "Supervielle",
  299: "Comafi",
  44: "Hipotecario",
  143: "Brubank",
  384: "Ualá",
}
const ENTIDADES = Object.keys(BANCOS).join(",")

type Row = Record<string, unknown>
type Dir = "asc" | "desc"
type Align = "left" | "right"
type Col = {
  key: string
  label: string
  align?: Align
  fmt?: (v: unknown, row: Row) => string
  sortVal?: (row: Row) => number | string
}

const pct = (v: unknown) => (v == null ? "—" : `${Number(v).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`)
const money = (v: unknown) => {
  if (v == null) return "—"
  const n = Number(v)
  if (n >= 1e9) return "s/tope"
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 })
}
const banco = (r: Row) => BANCOS[Number(r.codigoEntidad)] ?? String(r.descripcionEntidad ?? "")

// La API solo trae TEA; derivamos la TNA a 30 días (forma habitual de cotizar el PF).
function tna30(teaPct: unknown): number | null {
  if (teaPct == null) return null
  const tea = Number(teaPct) / 100
  if (!Number.isFinite(tea)) return null
  return (Math.pow(1 + tea, 30 / 365) - 1) * (365 / 30) * 100
}
const esHomeBanking = (r: Row) => String(r.canalConstitucion ?? "").toLowerCase().includes("home banking")

const COL_BANCO: Col = { key: "_banco", label: "Banco", fmt: (_v, r) => banco(r), sortVal: (r) => banco(r) }

type ProductoDef = {
  value: string
  label: string
  descripcion: string
  cols: Col[]
  defaultSort: { key: string; dir: Dir }
  filter?: (r: Row) => boolean
  /** Si se setea, deja una sola fila por banco: la de mayor valor en este campo. */
  onePerBank?: string
}

const PRODUCTOS: ProductoDef[] = [
  {
    value: "plazos",
    label: "Plazos fijos",
    descripcion: "Plazo fijo online (Home banking) — mejor tasa por banco · TNA 30 días y TEA",
    filter: esHomeBanking,
    onePerBank: "tasaEfectivaAnualMinima",
    cols: [
      COL_BANCO,
      { key: "nombreCorto", label: "Producto" },
      { key: "_tna", label: "TNA (30d)", align: "right", fmt: (_v, r) => pct(tna30(r.tasaEfectivaAnualMinima)), sortVal: (r) => tna30(r.tasaEfectivaAnualMinima) ?? -1 },
      { key: "tasaEfectivaAnualMinima", label: "TEA", align: "right", fmt: pct, sortVal: (r) => Number(r.tasaEfectivaAnualMinima ?? -1) },
    ],
    defaultSort: { key: "tasaEfectivaAnualMinima", dir: "desc" },
  },
  {
    value: "personales",
    label: "Préstamos personales",
    descripcion: "TEA y costo financiero total (CFT) — menor es mejor",
    cols: [
      COL_BANCO,
      { key: "nombreCorto", label: "Producto" },
      { key: "denominacion", label: "Moneda" },
      { key: "tasaEfectivaAnualMaxima", label: "TEA máx.", align: "right", fmt: pct, sortVal: (r) => Number(r.tasaEfectivaAnualMaxima ?? 1e9) },
      { key: "costoFinancieroEfectivoTotalMaximo", label: "CFT máx.", align: "right", fmt: pct, sortVal: (r) => Number(r.costoFinancieroEfectivoTotalMaximo ?? 1e9) },
      { key: "montoMaximoOtorgable", label: "Monto máx.", align: "right", fmt: (v) => money(v), sortVal: (r) => Number(r.montoMaximoOtorgable ?? 0) },
      { key: "plazoMaximoOtorgable", label: "Plazo máx. (m)", align: "right", fmt: (v) => (v == null ? "—" : String(v)), sortVal: (r) => Number(r.plazoMaximoOtorgable ?? 0) },
    ],
    defaultSort: { key: "tasaEfectivaAnualMaxima", dir: "asc" },
  },
  {
    value: "hipotecarios",
    label: "Hipotecarios",
    descripcion: "Créditos para vivienda — TEA, CFT y relación cuota/ingreso",
    cols: [
      COL_BANCO,
      { key: "nombreCorto", label: "Producto" },
      { key: "denominacion", label: "Moneda" },
      { key: "tasaEfectivaAnualMaxima", label: "TEA máx.", align: "right", fmt: pct, sortVal: (r) => Number(r.tasaEfectivaAnualMaxima ?? 1e9) },
      { key: "costoFinancieroEfectivoTotalMaximo", label: "CFT máx.", align: "right", fmt: pct, sortVal: (r) => Number(r.costoFinancieroEfectivoTotalMaximo ?? 1e9) },
      { key: "relacionCuotaIngreso", label: "Cuota/ingreso", align: "right", fmt: pct, sortVal: (r) => Number(r.relacionCuotaIngreso ?? 0) },
      { key: "plazoMaximoOtorgable", label: "Plazo máx. (m)", align: "right", fmt: (v) => (v == null ? "—" : String(v)), sortVal: (r) => Number(r.plazoMaximoOtorgable ?? 0) },
    ],
    defaultSort: { key: "tasaEfectivaAnualMaxima", dir: "asc" },
  },
  {
    value: "prendarios",
    label: "Prendarios",
    descripcion: "Créditos prendarios (autos) — TEA, CFT y montos",
    cols: [
      COL_BANCO,
      { key: "nombreCorto", label: "Producto" },
      { key: "denominacion", label: "Moneda" },
      { key: "tasaEfectivaAnualMaxima", label: "TEA máx.", align: "right", fmt: pct, sortVal: (r) => Number(r.tasaEfectivaAnualMaxima ?? 1e9) },
      { key: "costoFinancieroEfectivoTotalMaximo", label: "CFT máx.", align: "right", fmt: pct, sortVal: (r) => Number(r.costoFinancieroEfectivoTotalMaximo ?? 1e9) },
      { key: "montoMaximoOtorgable", label: "Monto máx.", align: "right", fmt: (v) => money(v), sortVal: (r) => Number(r.montoMaximoOtorgable ?? 0) },
      { key: "plazoMaximoOtorgable", label: "Plazo máx. (m)", align: "right", fmt: (v) => (v == null ? "—" : String(v)), sortVal: (r) => Number(r.plazoMaximoOtorgable ?? 0) },
    ],
    defaultSort: { key: "tasaEfectivaAnualMaxima", dir: "asc" },
  },
  {
    value: "tarjetas",
    label: "Tarjetas",
    descripcion: "Tarjetas de crédito — TEA de financiación y adelanto",
    cols: [
      COL_BANCO,
      { key: "nombreCorto", label: "Tarjeta" },
      { key: "tasaEfectivaAnualMaximaFinanciacion", label: "TEA financ.", align: "right", fmt: pct, sortVal: (r) => Number(r.tasaEfectivaAnualMaximaFinanciacion ?? 1e9) },
      { key: "tasaEfectivaAnualMaximaAdelantoEfectivo", label: "TEA adelanto", align: "right", fmt: pct, sortVal: (r) => Number(r.tasaEfectivaAnualMaximaAdelantoEfectivo ?? 1e9) },
      { key: "comisionMaximaAdministracionMantenimiento", label: "Mantenim.", align: "right", fmt: (v) => money(v), sortVal: (r) => Number(r.comisionMaximaAdministracionMantenimiento ?? 0) },
      { key: "segmento", label: "Segmento" },
    ],
    defaultSort: { key: "tasaEfectivaAnualMaximaFinanciacion", dir: "asc" },
  },
]

const ALL_CODES = Object.keys(BANCOS).map(Number)

export default function DatosBancariosPage() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set(ALL_CODES))

  const toggleBanco = (code: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  const todos = selected.size === ALL_CODES.length

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Landmark className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Datos bancarios</h1>
              <p className="text-muted-foreground">
                Productos de los principales bancos — Régimen de Transparencia del BCRA
              </p>
            </div>
          </div>
        </div>

        {/* Filtros compartidos: buscador + selector de bancos */}
        <div className="bg-card rounded-lg shadow-sm border p-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por banco o producto..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelected(new Set(ALL_CODES))}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                todos ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Todos
            </button>
            {ALL_CODES.map((code) => {
              const on = selected.has(code)
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleBanco(code)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    on
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "text-muted-foreground/60 hover:bg-muted border-border"
                  }`}
                >
                  {BANCOS[code]}
                </button>
              )
            })}
          </div>
        </div>

        <Tabs defaultValue="plazos">
          <TabsList className="flex-wrap h-auto">
            {PRODUCTOS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {PRODUCTOS.map((p) => (
            <TabsContent key={p.value} value={p.value}>
              <ProductoTabla def={p} query={query} selected={selected} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}

function ProductoTabla({
  def,
  query,
  selected,
}: {
  def: ProductoDef
  query: string
  selected: Set<number>
}) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ key: string; dir: Dir }>(def.defaultSort)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/transparencia?producto=${def.value}&entidades=${ENTIDADES}`)
        const json = await res.json()
        if (!cancel) setRows(json.results ?? [])
      } catch {
        if (!cancel) setRows([])
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [def.value])

  const sorted = useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    let filtered = rows.filter((r) => {
      if (def.filter && !def.filter(r)) return false
      if (selected.size > 0 && !selected.has(Number(r.codigoEntidad))) return false
      if (!q) return true
      const hay = `${banco(r)} ${r.nombreCorto ?? ""} ${r.nombreCompleto ?? ""} ${r.descripcionEntidad ?? ""}`.toLowerCase()
      return hay.includes(q)
    })

    // Saca filas idénticas (la API repite la misma oferta por bracket de monto/plazo)
    const vistos = new Set<string>()
    filtered = filtered.filter((r) => {
      const sig = JSON.stringify({ ...r, fechaInformacion: undefined })
      if (vistos.has(sig)) return false
      vistos.add(sig)
      return true
    })

    // Colapsa a una fila por banco (la de mejor tasa) cuando corresponde
    if (def.onePerBank) {
      const mejor = new Map<number, Row>()
      for (const r of filtered) {
        const code = Number(r.codigoEntidad)
        const v = Number(r[def.onePerBank!] ?? -Infinity)
        const cur = mejor.get(code)
        if (!cur || v > Number(cur[def.onePerBank!] ?? -Infinity)) mejor.set(code, r)
      }
      filtered = Array.from(mejor.values())
    }

    const col = def.cols.find((c) => c.key === sort.key)
    const val = (r: Row) =>
      col?.sortVal ? col.sortVal(r) : col?.fmt ? col.fmt(r[col.key], r) : (r[sort.key] as string | number)
    const arr = [...filtered].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === "number" && typeof vb === "number") return va - vb
      return String(va).localeCompare(String(vb))
    })
    return sort.dir === "desc" ? arr.reverse() : arr
  }, [rows, sort, def, query, selected])

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{def.label}</CardTitle>
        <CardDescription>
          {def.descripcion}
          {rows && !loading ? ` · ${sorted.length} ofertas` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando datos del BCRA...
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Sin datos para los bancos seleccionados.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  {def.cols.map((c) => (
                    <TableHead
                      key={c.key}
                      className={`${c.align === "right" ? "text-right" : ""} cursor-pointer select-none whitespace-nowrap`}
                      onClick={() => toggleSort(c.key)}
                    >
                      <span className={`inline-flex items-center gap-1 ${c.align === "right" ? "justify-end" : ""}`}>
                        {c.label}
                        <ArrowUpDown
                          className={`h-3 w-3 ${sort.key === c.key ? "text-primary" : "text-muted-foreground/40"}`}
                        />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r, i) => (
                  <TableRow key={i}>
                    {def.cols.map((c) => (
                      <TableCell
                        key={c.key}
                        className={`${c.align === "right" ? "text-right font-mono tabular-nums" : ""} ${c.key === "_banco" ? "font-semibold" : ""} whitespace-nowrap`}
                      >
                        {c.fmt ? c.fmt(r[c.key], r) : ((r[c.key] as string) ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
