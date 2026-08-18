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

// Qué variable maneja cada pata y cómo se lee su breakeven.
const DRIVER: Record<LegKind, { label: string; be: string; fmt: (v: number) => string }> = {
  TAMAR: { label: "TAMAR", be: "TNA TAMAR", fmt: (v) => `${(v * 100).toFixed(2)}%` },
  CER:   { label: "CER",   be: "inflación mensual", fmt: (v) => `${(v * 100).toFixed(2)}%` },
  DLK:   { label: "Dólar", be: "A3500 al vto.", fmt: (v) => `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` },
  FIJA:  { label: "Fija",  be: "—", fmt: () => "—" },
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

  // El VPV de un dual en dólares (TMVE8) sale en pesos por VNO USD 100, así que
  // es ~200.000 y no ~200. No es comparable contra el de un bono en pesos.
  const num = (v: number | null | undefined, d = 2) =>
    v === null || v === undefined
      ? "—"
      : v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })

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
          case "ganadora":    return r.ganadora
          case "vpv":         return r.vpv_max ?? 0
          case "ytm":         return r.lastPrice?.ytm_ars ?? -Infinity
          default:            return r.details?.vencimiento ?? ""
        }
      }
      const [x, y] = [get(a), get(b)]
      if (typeof x === "number" && typeof y === "number") return sortDirection === "asc" ? x - y : y - x
      return sortDirection === "asc"
        ? String(x).localeCompare(String(y))
        : String(y).localeCompare(String(x))
    })
  }, [rows, searchTerm, sortField, sortDirection])

  const Th = ({ field, children, className = "" }: { field: string; children: React.ReactNode; className?: string }) => (
    <TableHead className={`text-center ${className}`}>
      <Button variant="ghost" onClick={() => handleSort(field)} className="h-auto p-0 font-semibold">
        {children} <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    </TableHead>
  )

  // Celda de una pata: VPV arriba, TEM abajo, resaltada si es la que paga.
  const LegCell = ({ leg, kind }: { leg?: DualLeg; kind?: LegKind }) => {
    if (!leg || !kind) return <TableCell className="text-center text-muted-foreground">—</TableCell>
    return (
      <TableCell className={`text-center ${leg.is_winner ? "bg-emerald-500/10 font-semibold" : ""}`}>
        <div className="flex flex-col leading-tight">
          <span className="flex items-center justify-center gap-1">
            {num(leg.vpv, leg.vpv !== null && Math.abs(leg.vpv) > 10000 ? 0 : 2)}
            {leg.is_winner && <span className="text-emerald-600 text-xs">◄</span>}
          </span>
          <span className="text-xs text-muted-foreground">
            {leg.tem !== null ? `TEM ${pct(leg.tem, 3)}` : DRIVER[kind].label}
          </span>
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
            Pagan al vencimiento el <strong>máximo</strong> entre sus dos patas. La columna{" "}
            <strong>breakeven</strong> dice qué tendría que pasar para que gane la pata que hoy pierde;
            es el número que importa, más que la TIR de un escenario puntual.
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
                <TableHead className="text-center">Pata A</TableHead>
                <TableHead className="text-center">Pata B</TableHead>
                <Th field="ganadora">Paga</Th>
                <TableHead className="text-center">
                  <span className="flex items-center justify-center gap-1 font-semibold">
                    Breakeven
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Valor que tendría que tomar la variable de la pata perdedora para empatar.
                        En un CER/TAMAR se despeja fijando TAMAR en el supuesto del escenario, así que
                        se mueve si ese supuesto cambia: mirá la columna Supuesto.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <Th field="ytm">TIR $</Th>
                <TableHead className="text-center">Supuesto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No hay duales cargados.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const legs = Object.keys(r.patas) as LegKind[]
                // La ganadora primero, para que la lectura sea "paga esto, contra esto".
                const orden = [...legs].sort((a, b) =>
                  (r.patas[b]?.is_winner ? 1 : 0) - (r.patas[a]?.is_winner ? 1 : 0))
                const [a, b] = orden
                const perdedora = orden.find((l) => !r.patas[l]?.is_winner)
                const bePata = perdedora && r.patas[perdedora]?.breakeven !== null ? perdedora : undefined
                const be = bePata ? r.patas[bePata]!.breakeven! : null
                // El origen de la proyección lo graba cada motor en params.
                const supuesto = orden.map((l) => r.patas[l]?.params?.origen_proy)
                                      .find(Boolean) as string | undefined
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
                            Todavía no llegó cotización para este símbolo. El VPV y el breakeven
                            se calculan igual; sólo falta la TIR.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <LegCell leg={r.patas[a]} kind={a} />
                    <LegCell leg={r.patas[b]} kind={b} />
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">{r.ganadora}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {be === null || !bePata ? (
                        <span className="text-muted-foreground text-xs">pata determinística</span>
                      ) : (
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium">{DRIVER[bePata].fmt(be)}</span>
                          <span className="text-xs text-muted-foreground">{DRIVER[bePata].be}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{pct(r.lastPrice?.ytm_ars)}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="underline decoration-dotted">
                          {supuesto ?? "—"}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs space-y-1">
                          <p>
                            Se muestra el supuesto de la pata <strong>{r.ganadora}</strong> porque es
                            el que califica el breakeven: la variable de la otra pata se despeja
                            manteniendo esta fija.
                          </p>
                          {orden.map((l) => (
                            <p key={l}>
                              {l}: {String(r.patas[l]?.params?.origen_proy ?? "—")}
                            </p>
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
          VPV = valor de pago al vencimiento, base 100 de valor nominal. Ojo: en los duales
          denominados en dólares (TMVE8) el nominal son USD 100, así que el VPV sale en pesos por
          VNO USD 100 y no es comparable contra el de un dual en pesos. La TIR es nominal en pesos
          (<code>prices.ytm_ars</code>), que es la única convención comparable entre patas.
        </p>
      </div>
    </TooltipProvider>
  )
}
