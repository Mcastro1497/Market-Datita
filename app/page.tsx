import { redirect } from "next/navigation"

// La landing de tarjetas se sacó: la raíz entra directo al dashboard. El sidebar
// ya lista todos los dashboards, así que una pantalla intermedia sólo agregaba
// un clic. El logo del sidebar también apunta acá, así que sigue funcionando
// como "volver al inicio".
export default function Home() {
  redirect("/soberanos")
}
