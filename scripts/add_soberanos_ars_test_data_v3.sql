-- Adding comprehensive test data for Soberanos ARS with S30S5 ticker
-- Insert test data into soberanos_ars_details
INSERT INTO soberanos_ars_details (ticker, tipo, moneda, lamina_minima, monto_residual, fecha_vencimiento)
VALUES 
  ('S30S5', 'Soberano', 'ARS', 1000.00, 85000000000.00, '2030-07-09')
ON CONFLICT (ticker) DO UPDATE SET
  tipo = EXCLUDED.tipo,
  moneda = EXCLUDED.moneda,
  lamina_minima = EXCLUDED.lamina_minima,
  monto_residual = EXCLUDED.monto_residual,
  fecha_vencimiento = EXCLUDED.fecha_vencimiento;

-- Insert test data into soberanos_ars_flows
INSERT INTO soberanos_ars_flows (ticker, emisor, tipo, fecha_pago, cupon, interes, amortizacion, total, valor_residual, dias, moneda_pago, moneda_denominacion)
VALUES 
  ('S30S5', 'República Argentina', 'Soberano', '2025-01-09', 8.50, 3612500000.00, 0.00, 3612500000.00, 85000000000.00, 28, 'ARS', 'ARS'),
  ('S30S5', 'República Argentina', 'Soberano', '2025-07-09', 8.50, 3612500000.00, 0.00, 3612500000.00, 85000000000.00, 181, 'ARS', 'ARS'),
  ('S30S5', 'República Argentina', 'Soberano', '2026-01-09', 8.50, 3612500000.00, 0.00, 3612500000.00, 85000000000.00, 365, 'ARS', 'ARS'),
  ('S30S5', 'República Argentina', 'Soberano', '2026-07-09', 8.50, 3612500000.00, 0.00, 3612500000.00, 85000000000.00, 546, 'ARS', 'ARS'),
  ('S30S5', 'República Argentina', 'Soberano', '2030-07-09', 8.50, 3612500000.00, 85000000000.00, 88612500000.00, 0.00, 1827, 'ARS', 'ARS')
ON CONFLICT (ticker, fecha_pago) DO UPDATE SET
  emisor = EXCLUDED.emisor,
  tipo = EXCLUDED.tipo,
  cupon = EXCLUDED.cupon,
  interes = EXCLUDED.interes,
  amortizacion = EXCLUDED.amortizacion,
  total = EXCLUDED.total,
  valor_residual = EXCLUDED.valor_residual,
  dias = EXCLUDED.dias,
  moneda_pago = EXCLUDED.moneda_pago,
  moneda_denominacion = EXCLUDED.moneda_denominacion;
