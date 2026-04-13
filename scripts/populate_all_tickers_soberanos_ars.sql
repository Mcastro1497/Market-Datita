-- Insertar tickers de Soberanos ARS en la tabla all_tickers
-- Primero eliminamos cualquier registro existente de Soberanos ARS para evitar duplicados
DELETE FROM all_tickers WHERE tipo_instrumento = 'Soberanos ARS';

-- Insertar los tickers de soberanos_ars_details en all_tickers
INSERT INTO all_tickers (
  ticker,
  tipo_instrumento,
  fecha_vencimiento,
  monto_residual,
  calleable,
  legislacion,
  jurisdiccion_pago,
  lamina_minima,
  sector,
  rating,
  moneda,
  created_at,
  updated_at
)
SELECT 
  sad.ticker,
  'Soberanos ARS' as tipo_instrumento,
  sad.fecha_vencimiento,
  sad.monto_residual,
  false as calleable, -- Los soberanos ARS generalmente no son calleable
  null as legislacion, -- No disponible en soberanos_ars_details
  null as jurisdiccion_pago, -- No disponible en soberanos_ars_details
  sad.lamina_minima,
  null as sector, -- No disponible en soberanos_ars_details
  null as rating, -- No disponible en soberanos_ars_details
  sad.moneda,
  NOW() as created_at,
  NOW() as updated_at
FROM soberanos_ars_details sad
WHERE sad.ticker IS NOT NULL
ON CONFLICT (ticker, tipo_instrumento) DO UPDATE SET
  fecha_vencimiento = EXCLUDED.fecha_vencimiento,
  monto_residual = EXCLUDED.monto_residual,
  lamina_minima = EXCLUDED.lamina_minima,
  moneda = EXCLUDED.moneda,
  updated_at = NOW();

-- Verificar los resultados
SELECT 
  tipo_instrumento,
  COUNT(*) as cantidad_tickers
FROM all_tickers 
GROUP BY tipo_instrumento
ORDER BY tipo_instrumento;

-- Mostrar algunos ejemplos de Soberanos ARS insertados
SELECT * FROM all_tickers 
WHERE tipo_instrumento = 'Soberanos ARS' 
ORDER BY ticker 
LIMIT 5;
