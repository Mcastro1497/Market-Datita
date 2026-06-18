## Resumen

Apunta el **frontend** a la nueva tabla `instruments_v2` (reemplazo de `instruments`),
usando los nombres de columna nuevos y dejando el modelo de datos listo para las
columnas que se agregaron en v2. Pensado para **probar v2 en paralelo** sin afectar
producción.

`instruments` sigue intacta y los scripts de Python (TIR_v5, Cer_v4) **no se tocan**.

## Mapa de renombres aplicado

| viejo (`instruments`) | nuevo (`instruments_v2`) |
|---|---|
| `fecha_vencimiento` | `vencimiento` |
| `fecha_emision` | `emision` |
| `cupon` | `tasa_int` |
| `moneda` | `moneda_denom` |
| `lamina_minima` | `lamina_min` |
| `monto_residual` | `vr_vigente` |
| `tipo` | `tipo_cupon` |
| `calleable` | `callable` |

Sin cambios: `symbol, emisor, legislacion, jurisdiccion_pago, instrument_type, segment, is_active, cer_emision`.

Columnas nuevas de v2 sumadas al modelo (`lib/types.ts`), aún sin renderizar todas en la UI:
`moneda_pago` (usada, distingue dólar-linked), `denominacion, tipo_activo, clase, serie, isin,
convencion_int, periodicidad_int, margen_ref, tasa_ref, operacion_min, vn_vigente, valor_residual, referencias`.

## Cambios (13 archivos, solo frontend)

**Páginas / fetch** — `from("instruments")` → `from("instruments_v2")` + remapeo de columnas en `details`:
- `app/soberanos/page.tsx`
- `app/ons/page.tsx`
- `app/dlk/page.tsx` (suma `moneda_pago` para dólar-linked)
- `app/soberanos-ars/page.tsx` (filtros `tipo_cupon`/`moneda_denom` y tabs CER/Fija/TAMAR)

**Componente que lee `instruments` directo:**
- `components/all-tickers-table.tsx` (→ `instruments_v2`; `tipo_activo` ahora nativo en v2)

**Tablas de detalle** — accesos `details?.X` + claves de sort renombradas:
- `components/soberanos-details-table.tsx`, `ons-details-table.tsx`, `dlk-details-table.tsx`
- `components/soberanos-ars-details-table.tsx`, `soberanos-ars-cer-table.tsx`, `soberanos-ars-fija-table.tsx`, `soberanos-ars-tamar-table.tsx`

**Tipos:**
- `lib/types.ts` (`Instrument`, los 3 sub-shapes `details`, `AllTicker` + columnas nuevas)

## Fuera de alcance (no tocado)

- Scripts de Python (TIR_v5, Cer_v4) y tabla `instruments` → siguen alimentando producción.
- Uploaders (`instruments-uploader`, `instrument-flows-uploader`) → siguen escribiendo/validando contra `instruments` con nombres viejos.

⚠️ **Nota de datos:** `instruments_v2` solo mostrará datos frescos si se la está poblando/sincronizando.
Hoy los scripts de Python escriben a `instruments`. Para que el frontend v2 vea datos vivos,
en algún momento habrá que adaptar los scripts a `instruments_v2` o sincronizar ambas tablas (trabajo de backend, en otro PR).

## Verificación

- ✅ `npm run build` → **Compiled successfully**, las 13 rutas se generan (con env vars de Supabase presentes).
- ✅ `tsc --noEmit` → **23 errores, idénticos a `main`** (mismos archivos/conteo, todos preexistentes por el cliente Supabase sin tipar). **Cero errores nuevos.**
- ℹ️ El build necesita `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`; sin ellas falla en el prerender de `/cer-historico` (ambiental, pasa igual en `main`).

## Checklist de validación (post-merge a preview)

- [ ] `/soberanos` (HD) carga, ordena y filtra (emisor/legislación/jurisdicción/vencimiento)
- [ ] `/ons` carga, ordena y filtra
- [ ] `/dlk` carga; `moneda_pago` distingue dólar-linked; precio ARS/USD correcto
- [ ] `/soberanos-ars` — tabs CER / Fija / TAMAR con conteos correctos; filtros tipo/moneda
- [ ] `/todos-los-tickers` — vencimiento, vr_vigente y callable se ven bien
- [ ] Sorting por las columnas renombradas funciona en todas las tablas
- [ ] No hay columnas en "—"/vacías que antes traían dato (posible nombre mal mapeado)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
