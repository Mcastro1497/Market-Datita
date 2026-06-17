import { HandCoins } from "lucide-react"
import CalculatorTabs from "@/components/financiamiento/CalculatorTabs"

export default function FinanciamientoPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <HandCoins className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Financiamiento</h1>
              <p className="text-muted-foreground">
                Descuento de eCheq, carteras y pagarés — tasa, comisión, IVA, IIBB y derechos de mercado
              </p>
            </div>
          </div>
        </div>

        <CalculatorTabs />
      </div>
    </div>
  )
}
