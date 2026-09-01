"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { DualRow, DualLeg, LegKind } from "@/lib/types"
import { ArrowUpDown, Search, Info, Split } from "lucide-react"

interface DualesTableProps {
  rows: DualRow[]
}

// Cómo se nombra cada pata y cómo se lee su breakeven. El nombre va DENTRO de la
// celda porque cuál es la pata A y cuál la B cambia por fila (la ganadora va
// primero), así que no puede estar en el encabezado.
const LEG: Record<LegKind, { nombre: string; be: string; fmtBe: (v: number) => string }> = {
  TAMAR: { nombre: "TAMAR",  be: "TNA TAMAR promedio",  fmtBe: (v) => `${(v * 100).toFixed(2)}%` },
  CER:   { nombre: "CER",    be: "inflación mensual",   fmtBe: (v) => `${(v * 100).toFixed(2)}%` },
  DLK:   { nombre: "USD-L",  be: "A3500 al vencimiento", fmtBe: (v) => `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` },
  FIJA:  { nombre: "Fija",   be: "—",                   fmtBe: () => "—" },
}

// Unidad en la que está la TIR nativa de la pata (valuations.ytm_conv).
const CONV: Record<string, { sufijo: string; ayuda: string }> = {
  nominal_ars: { sufijo: "TEA $",    ayuda: "TIR nominal anual en pesos." },
  real_cer:    { sufijo: "TEA real", ayuda: "TIR real anual sobre CER: no depende de proyectar inflación." },
  usd:         { sufijo: "TEA USD",  ayuda: "TIR anual en dólares: no depende de proyectar el tipo de cambio." },
}

export function DualesTable({ rows }: DualesTableProps) {
  const [sortField, setSortField] = useState<string>("vencimiento")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [searchTerm, setSearchTerm] = useState("")

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDirection("asc") }
  }

  const pct = (v: number | null | undefined, d = 2) =>
    v === null || v === undefined ? "—" : `${(v * 100).toFixed(d)}%`

  // Los duales en dólares (TMVE8) tienen nominal USD 100, así que su VPV sale en
  // pesos por VNO USD 100 (~200.000). Sin decimales para que no sea ilegible.
  const num = (v: number | null | undefined) =>
    v === null || v === undefined
      ? "—"
      : Math.abs(v) > 10000
        ? v.toLocaleString("es-AR", { maximumFractionDigits: 0 })
        : v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const filtered = useMemo(() => {
    let out = rows
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      out = out.filter((r) =>
        r.symbol.toLowerCase().includes(q) ||
        (r.details?.denominacion ?? "").toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q))
    }
    return [...out].sort((a, b) => {
      const get = (r: DualRow) => {
        switch (sortField) {
          case "symbol":      return r.symbol
          case "vencimiento": return r.details?.vencimiento ?? ""
          case "kind":        return r.kind
          case "ventaja":     return r.ventaja ?? 0
          default:            return r.details?.vencimiento ?? ""
        }
      }
      const [x, y] = [get(a), get(b)]
      // Vencimiento vacío al final en ambas direcciones, igual que en el resto
      // de las tablas: una fila sin fecha no encabeza la curva.
      if (sortField === "vencimiento" || sortField === "") {
        const vx = x === "", vy = y === ""
        if (vx || vy) return vx === vy ? 0 : vx ? 1 : -1
      }
      if (typeof x === "number" && typeof y === "number") return sortDirection === "asc" ? x - y : y - x
      return sortDirection === "asc"
        ? String(x).localeCompare(String(y))
        : String(y).localeCompare(String(x))
    })
  }, [rows, searchTerm, sortField, sortDirection])

  const Th = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead className="text-center">
      <Button variant="ghost" onClick={() => handleSort(field)} className="h-auto p-0 font-semibold">
        {children} <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    </TableHead>
  )

  // Una pata: nombre, VPV, TEM si devenga tasa, y su TIR EN SU PROPIA UNIDAD.
  // Mostrar la nominal acá sería inútil: nadie quotea una pata dólar-linked en
  // pesos. La nominal queda en el tooltip, que es la que decide quién gana.
  const LegCell = ({ kind, leg }: { kind?: LegKind; leg?: DualLeg }) => {
    if (!kind || !leg) return <TableCell className="text-center text-muted-foreground">—</TableCell>
    const conv = CONV[leg.ytm_conv ?? "nominal_ars"] ?? CONV.nominal_ars
    const mismaUnidad = (leg.ytm_conv ?? "nominal_ars") === "nominal_ars"
    return (
      <TableCell className={`text-center ${leg.is_winner ? "bg-emerald-500/10" : ""}`}>
        <div className="flex flex-col items-center gap-1 leading-tight">
          <Badge variant={leg.is_winner ? "default" : "outline"}
                 className={leg.is_winner ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
            {LEG[kind].nombre}
          </Badge>
          <span className={leg.is_winner ? "font-semibold" : ""}>{num(leg.vpv)}</span>
          {leg.tem !== null && leg.tem !== undefined && (
            <span className="text-xs text-muted-foreground">TEM {pct(leg.tem, 3)}</span>
          )}
          {leg.ytm_nativa !== null && leg.ytm_nativa !== undefined ? (
            <Tooltip>
              <TooltipTrigger className="text-sm font-medium underline decoration-dotted">
                {pct(leg.ytm_nativa)} <span className="text-xs font-normal text-muted-foreground">{conv.sufijo}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs space-y-1">
                <p>{conv.ayuda}</p>
                {!mismaUnidad && (
                  <p className="text-muted-foreground">
                    Equivalente nominal en pesos: <strong>{pct(leg.ytm)}</strong>. Es la que se
                    compara contra la otra pata para decidir cuál paga, porque es la única unidad
                    común entre las dos.
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground">s/precio</span>
          )}
        </div>
      </TableCell>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="bg-lb-violet-accent/10 border border-lb-violet-accent/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Split className="h-5 w-5 text-lb-violet-accent" />
            <h3 className="font-semibold text-lb-violet-accent">Bonos Duales</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Pagan al vencimiento el <strong>máximo</strong> entre sus dos patas. Cada pata se muestra
            con su TIR <strong>en su propia unidad</strong>: la TAMAR en pesos, la CER en tasa real y
            la dólar-linked en dólares, para compararla contra la curva de su clase. El{" "}
            <strong>breakeven</strong> dice qué tendría que pasar para que gane la que hoy pierde.
          </p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar ticker o tipo..." value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <Th field="symbol">Ticker</Th>
                <Th field="kind">Tipo</Th>
                <Th field="vencimiento">Vto.</Th>
                <TableHead className="text-center">Precio</TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center justify-center gap-1 font-semibold">
                    Pata que paga
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        La que hoy tiene el VPV más alto, comparando ambas en pesos nominales.
                        Es la que cobrarías si todo se mantuviera como está.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead className="text-center">Pata alternativa</TableHead>
                <Th field="ventaja">Ventaja</Th>
                <TableHead className="text-center">
                  <span className="flex items-center justify-center gap-1 font-semibold">
                    Breakeven
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Valor que tendría que tomar la variable de la pata alternativa para empatar.
                        Se despeja manteniendo fija la pata que paga, así que se mueve con el
                        supuesto de esa pata: mirá la columna Supuesto.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead className="text-center">Supuesto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No hay duales cargados.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const legs = Object.keys(r.patas) as LegKind[]
                // Ganadora primero: la fila se lee "paga esto, contra esto".
                const orden = [...legs].sort((a, b) =>
                  (r.patas[b]?.is_winner ? 1 : 0) - (r.patas[a]?.is_winner ? 1 : 0))
                const [gana, alt] = orden
                const be = alt && r.patas[alt]?.breakeven != null ? r.patas[alt]!.breakeven! : null
                const supuesto = r.patas[gana]?.params?.origen_proy as string | undefined
                const extrap = orden.reduce((m, l) =>
                  Math.max(m, Number(r.patas[l]?.params?.meses_extrapolados ?? 0)), 0)

                return (
                  <TableRow key={`${r.symbol}-${r.scenario}`}>
                    <TableCell className="font-medium">{r.symbol}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{r.kind.replace("DUAL:", "")}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{r.details?.vencimiento ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      {r.lastPrice?.price_ars != null ? num(r.lastPrice.price_ars) : (
                        <Tooltip>
                          <TooltipTrigger className="text-muted-foreground">s/precio</TooltipTrigger>
                          <TooltipContent>
                            Todavía no llegó cotización. El VPV y el breakeven se calculan igual;
                            sólo falta la TIR.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <LegCell kind={gana} leg={r.patas[gana]} />
                    <LegCell kind={alt} leg={alt ? r.patas[alt] : undefined} />
                    <TableCell className="text-center">
                      {r.ventaja == null ? "—" : (
                        <Tooltip>
                          <TooltipTrigger className={`underline decoration-dotted ${r.ventaja < 0.05 ? "text-amber-600 font-medium" : ""}`}>
                            {pct(r.ventaja, 1)}
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Cuánto le saca la pata que paga a la alternativa, en pesos.
                            {r.ventaja < 0.05
                              ? " Menos de 5%: la opción está viva y el pago final puede darse vuelta."
                              : " Con esta distancia la pata alternativa es difícil que gane."}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {be === null || !alt ? (
                        <span className="text-muted-foreground text-xs">pata determinística</span>
                      ) : (
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium">{LEG[alt].fmtBe(be)}</span>
                          <span className="text-xs text-muted-foreground">{LEG[alt].be}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="underline decoration-dotted">
                          {supuesto ?? "—"}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs space-y-1">
                          <p>
                            Es el supuesto de la pata <strong>{LEG[gana]?.nombre}</strong>, que es el
                            que califica el breakeven: la variable de la alternativa se despeja
                            manteniendo esta fija.
                          </p>
                          {orden.map((l) => (
                            <p key={l}>{LEG[l].nombre}: {String(r.patas[l]?.params?.origen_proy ?? "—")}</p>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                      {extrap > 0 && (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="ml-1 text-amber-600">+{extrap}m</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {extrap} meses quedan fuera del horizonte del REM y se extrapolan
                            sosteniendo la última cifra conocida. Ese tramo es supuesto propio,
                            no proyección relevada.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          VPV = valor de pago al vencimiento, base 100 de valor nominal. En los duales denominados en
          dólares (TMVE8) el nominal son USD 100, así que el VPV sale en pesos por VNO USD 100 y no
          es comparable contra el de un dual en pesos. Cada TIR está en la unidad que indica su
          sufijo; el tooltip muestra el equivalente nominal en pesos, que es el que decide qué pata
          paga.
        </p>
      </div>
    </TooltipProvider>
  )
}
