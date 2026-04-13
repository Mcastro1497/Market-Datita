"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Hash } from "lucide-react"
import type { ONFlow } from "@/lib/types"

interface ONSMetricsProps {
  data: ONFlow[]
}

export function ONSMetrics({ data }: ONSMetricsProps) {
  const uniqueEmisores = new Set(data.map((flow) => flow.emisor)).size
  const uniqueONs = new Set(data.map((flow) => flow.ticker)).size

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Emisores Únicos</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueEmisores}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">ONs Únicas</CardTitle>
          <Hash className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueONs}</div>
          <p className="text-xs text-muted-foreground">Cantidad de tickers únicos</p>
        </CardContent>
      </Card>
    </div>
  )
}
