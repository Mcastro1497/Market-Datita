-- Limpiar datos existentes para el ticker S30S5
DELETE FROM soberanos_ars_flows WHERE ticker = 'S30S5';
DELETE FROM soberanos_ars_details WHERE ticker = 'S30S5';

-- Insertar datos en soberanos_ars_details
INSERT INTO soberanos_ars_details (
    id,
    ticker,
    monto_residual,
    moneda,
    lamina_minima,
    tipo,
    fecha_vencimiento,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'S30S5',
    1000000000,
    'ARS',
    100000,
    'Soberano',
    '2030-05-15',
    now(),
    now()
);

-- Insertar múltiples flujos de pago en soberanos_ars_flows
INSERT INTO soberanos_ars_flows (
    id,
    ticker,
    emisor,
    fecha_pago,
    cupon,
    interes,
    amortizacion,
    total,
    valor_residual,
    dias,
    moneda_pago,
    moneda_denominacion,
    tipo,
    created_at,
    updated_at
) VALUES 
-- Primer pago de intereses
(
    gen_random_uuid(),
    'S30S5',
    'República Argentina',
    '2025-05-15',
    8.5,
    85000000,
    0,
    85000000,
    1000000000,
    153,
    'ARS',
    'ARS',
    'Soberano',
    now(),
    now()
),
-- Segundo pago de intereses
(
    gen_random_uuid(),
    'S30S5',
    'República Argentina',
    '2025-11-15',
    8.5,
    85000000,
    0,
    85000000,
    1000000000,
    337,
    'ARS',
    'ARS',
    'Soberano',
    now(),
    now()
),
-- Tercer pago de intereses
(
    gen_random_uuid(),
    'S30S5',
    'República Argentina',
    '2026-05-15',
    8.5,
    85000000,
    0,
    85000000,
    1000000000,
    519,
    'ARS',
    'ARS',
    'Soberano',
    now(),
    now()
),
-- Pago final con amortización
(
    gen_random_uuid(),
    'S30S5',
    'República Argentina',
    '2030-05-15',
    8.5,
    85000000,
    1000000000,
    1085000000,
    0,
    1980,
    'ARS',
    'ARS',
    'Soberano',
    now(),
    now()
);
