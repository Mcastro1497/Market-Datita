/**
 * Proxy a la serie intradiaria del mayorista de MAE.
 *
 * POR QUÉ UN PROXY Y NO FETCH DESDE EL BROWSER
 * Para no depender de que MAE mantenga los CORS abiertos ni de qué IP tenga el
 * visitante. El host público `api.marketdata.mae.com.ar` sí contesta desde un
 * datacenter —está medido: el de la API con key devuelve 403 desde un runner y
 * éste 200 en la misma corrida—, así que el servidor de Next puede pedirlo.
 *
 * QUÉ DEVUELVE MAE
 * `precios` y `volumenes`, una entrada por OPERACIÓN, no por minuto. El volumen
 * es el de esa operación, no un acumulado del día: no hay que restar nada.
 *
 * OJO CON LOS TIMESTAMPS
 * `time` es la hora de Buenos Aires codificada como si fuera UTC. Verificado el
 * 2026-09-09: la serie termina en 1788965093, que como UTC son las 14:44 y como
 * UTC-3 las 11:44 — y la rueda de ese día cerró después de las 14:44, con el
 * mismo precio (1514). Se devuelve el epoch crudo y el cliente formatea en UTC,
 * que es lo que da la hora local correcta.
 */

const MAE = "https://api.marketdata.mae.com.ar/api/mercado/datosgrafico"

export const revalidate = 30

export async function GET(req: Request) {
  const pedido = new URL(req.url)
  // Sin fecha, la rueda de hoy en hora argentina.
  const fecha =
    pedido.searchParams.get("fecha") ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
      .format(new Date())

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ error: "fecha inválida" }, { status: 400 })
  }

  const o = JSON.stringify({
    plazo: "000", segmento: "M", moneda: "T", tipoFecha: "D",
    fecha, fechaHasta: fecha, codTitulo: "UST$T",
  })

  try {
    const r = await fetch(`${MAE}?oTitulo=${encodeURIComponent(o)}`, {
      headers: { "User-Agent": "marketweb/1.0", Accept: "application/json" },
      next: { revalidate: 30 },
    })
    if (!r.ok) {
      return Response.json({ error: `MAE respondió ${r.status}`, fecha }, { status: 502 })
    }
    const d = await r.json()
    return Response.json({
      fecha,
      precios: Array.isArray(d?.precios) ? d.precios : [],
      volumenes: Array.isArray(d?.volumenes) ? d.volumenes : [],
    })
  } catch (e) {
    return Response.json(
      { error: `no se pudo consultar MAE: ${String(e).slice(0, 120)}`, fecha },
      { status: 502 },
    )
  }
}
