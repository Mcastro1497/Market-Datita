import { AllTickersTable } from "@/components/all-tickers-table"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function TodosLosTickersPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Todos los Tickers</h1>
          <p className="text-gray-600">Vista consolidada de ONs, Soberanos Hard Dollar y Soberanos ARS</p>
        </div>
      </div>

      <AllTickersTable />
    </div>
  )
}
