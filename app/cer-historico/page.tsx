import CerHistoricoTable from "@/components/cer-historico-table"

export default function CerHistoricoPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Histórico CER</h1>
        <p className="text-muted-foreground mt-2">
          Seguimiento del Coeficiente de Estabilización de Referencia a lo largo del tiempo
        </p>
      </div>

      <CerHistoricoTable />
    </div>
  )
}
