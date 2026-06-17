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
import { Landmark, Loader2, ArrowUpDown } from "lucide-react"

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

const COL_BANCO: Col = { key: "_banco", label: "Banco", fmt: (_v, r) => banco(r), sortVal: (r) => banco(r) }

type ProductoDef = {
  value: string
  label: string
  descripcion: string
  cols: Col[]
  defaultSort: { key: string; dir: Dir }
}

const PRODUCTOS: ProductoDef[] = [
  {
    value: "plazos",
    label: "Plazos fijos",
    descripcion: "Tasa efectiva anual (TEA) por banco — mayor es mejor",
    cols: [
      COL_BANCO,
      { key: "nombreCorto", label: "Producto" },
      { key: "tasaEfectivaAnualMinima", label: "TEA", align: "right", fmt: pct, sortVal: (r) => Number(r.tasaEfectivaAnualMinima ?? -1) },
      { key: "montoMinimoInvertir", label: "Monto mín.", align: "right", fmt: (v) => money(v), sortVal: (r) => Number(r.montoMinimoInvertir ?? 0) },
      { key: "plazoMinimoInvertirDias", label: "Plazo mín. (días)", align: "right", fmt: (v) => (v == null ? "—" : String(v)), sortVal: (r) => Number(r.plazoMinimoInvertirDias ?? 0) },
      { key: "canalConstitucion", label: "Canal" },
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

export default function DatosBancariosPage() {
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
              <ProductoTabla def={p} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}

function ProductoTabla({ def }: { def: ProductoDef }) {
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
    const col = def.cols.find((c) => c.key === sort.key)
    const val = (r: Row) =>
      col?.sortVal ? col.sortVal(r) : col?.fmt ? col.fmt(r[col.key], r) : (r[sort.key] as string | number)
    const arr = [...rows].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === "number" && typeof vb === "number") return va - vb
      return String(va).localeCompare(String(vb))
    })
    return sort.dir === "desc" ? arr.reverse() : arr
  }, [rows, sort, def])

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
