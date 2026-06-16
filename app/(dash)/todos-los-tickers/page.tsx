import { AllTickersTable } from "@/components/all-tickers-table"

export default function TodosLosTickersPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Todos los Tickers</h1>
        <p className="text-muted-foreground">Vista consolidada de ONs, Soberanos Hard Dollar y Soberanos ARS</p>
      </div>

      <AllTickersTable />
    </div>
  )
}
