-- Simple test to insert basic data into soberanos_ars_flows
-- First, let's see what's in the table
SELECT COUNT(*) as total_flows FROM soberanos_ars_flows;

-- Try a very simple insert
INSERT INTO soberanos_ars_flows (
    ticker,
    fecha_pago,
    amortizacion,
    interes,
    tipo
) VALUES (
    'S30S5',
    '2025-01-15',
    1000000.00,
    50000.00,
    'Soberano'
);

-- Check if it worked
SELECT * FROM soberanos_ars_flows WHERE ticker = 'S30S5';
