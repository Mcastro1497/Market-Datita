-- Clear existing test data and add fresh data for Soberanos ARS with S30S5 ticker
-- Removing ON CONFLICT clauses and using simple INSERT after DELETE

-- Clear existing data for S30S5 ticker
DELETE FROM soberanos_ars_flows WHERE ticker = 'S30S5';
DELETE FROM soberanos_ars_details WHERE ticker = 'S30S5';

-- Insert test data into soberanos_ars_details
INSERT INTO soberanos_ars_details (ticker, tipo, moneda, lamina_minima, monto_residual, fecha_vencimiento)
VALUES ('S30S5', 'Soberano', 'ARS', 1000.00, 85000000000.00, '2030-07-09');

-- Insert test data into soberanos_ars_flows
INSERT INTO soberanos_ars_flows (ticker, emisor, tipo, fecha_pago, cupon, interes, amortizacion, total, valor_residual, dias, moneda_pago, moneda_denominacion)
VALUES 
  ('S30S5', 'República Argentina', 'Soberano', '2025-01-09', 8.50, 3612500000.00, 0.00, 3612500000.00, 85000000000.00, 28, 'ARS', 'ARS'),
  ('S30S5', 'República Argentina', 'Soberano', '2025-07-09', 8.50, 3612500000.00, 0.00, 3612500000.00, 85000000000.00, 181, 'ARS', 'ARS'),
  ('S30S5', 'República Argentina', 'Soberano', '2026-01-09', 8.50, 3612500000.00, 0.00, 3612500000.00, 85000000000.00, 365, 'ARS', 'ARS'),
  ('S30S5', 'República Argentina', 'Soberano', '2026-07-09', 8.50, 3612500000.00, 0.00, 3612500000.00, 85000000000.00, 546, 'ARS', 'ARS'),
  ('S30S5', 'República Argentina', 'Soberano', '2030-07-09', 8.50, 3612500000.00, 85000000000.00, 88612500000.00, 0.00, 1827, 'ARS', 'ARS');
