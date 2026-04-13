-- Fixed SQL script to match actual table structure without legislacion column
-- Insert test data for soberanos_ars_details table
INSERT INTO soberanos_ars_details (
  ticker,
  monto_residual,
  moneda,
  lamina_minima,
  tipo,
  fecha_vencimiento
) VALUES (
  'S30S5',
  1000000000.00,
  'ARS',
  1000.00,
  'Soberano',
  '2030-07-09'
);

-- Insert test data for soberanos_ars_flows table
INSERT INTO soberanos_ars_flows (
  ticker,
  interes,
  dias,
  amortizacion,
  valor_residual,
  moneda_pago,
  emisor,
  moneda_denominacion,
  total,
  cupon,
  fecha_pago,
  tipo
) VALUES 
(
  'S30S5',
  45000000.00,
  182,
  0.00,
  1000000000.00,
  'ARS',
  'República Argentina',
  'ARS',
  45000000.00,
  4.50,
  '2025-01-09',
  'Soberano'
),
(
  'S30S5',
  45000000.00,
  182,
  0.00,
  1000000000.00,
  'ARS',
  'República Argentina',
  'ARS',
  45000000.00,
  4.50,
  '2025-07-09',
  'Soberano'
),
(
  'S30S5',
  45000000.00,
  182,
  1000000000.00,
  0.00,
  'ARS',
  'República Argentina',
  'ARS',
  1045000000.00,
  4.50,
  '2030-07-09',
  'Soberano'
);
