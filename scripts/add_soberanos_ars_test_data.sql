-- Insertar datos de prueba para Soberanos ARS con ticker S30S5

-- Insertar en soberanos_ars_details
INSERT INTO soberanos_ars_details (
    id,
    ticker,
    monto_residual,
    moneda,
    lamina_minima,
    tipo,
    fecha_vencimiento,
    legislacion,
    jurisdiccion_pago,
    calleable,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'S30S5',
    15000000000,  -- 15 mil millones ARS
    'ARS',
    1000,  -- Lámina mínima de $1,000 ARS
    'Soberano',
    '2030-07-09',  -- Vencimiento en 2030
    'Argentina',
    'Argentina',
    false,  -- No es calleable
    NOW(),
    NOW()
) ON CONFLICT (ticker) DO UPDATE SET
    monto_residual = EXCLUDED.monto_residual,
    moneda = EXCLUDED.moneda,
    lamina_minima = EXCLUDED.lamina_minima,
    tipo = EXCLUDED.tipo,
    fecha_vencimiento = EXCLUDED.fecha_vencimiento,
    legislacion = EXCLUDED.legislacion,
    jurisdiccion_pago = EXCLUDED.jurisdiccion_pago,
    calleable = EXCLUDED.calleable,
    updated_at = NOW();

-- Insertar en soberanos_ars_flow
INSERT INTO soberanos_ars_flow (
    id,
    ticker,
    emisor,
    interes,
    dias,
    amortizacion,
    valor_residual,
    moneda_pago,
    cupon,
    fecha_pago,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'S30S5',
    'República Argentina',
    750000000,  -- Interés de 750 millones ARS
    90,  -- 90 días hasta el próximo pago
    0,  -- Sin amortización en este pago
    15000000000,  -- Valor residual de 15 mil millones ARS
    'ARS',
    0.05,  -- Cupón del 5%
    '2025-04-09',  -- Próximo pago en abril 2025
    NOW(),
    NOW()
) ON CONFLICT (ticker, fecha_pago) DO UPDATE SET
    emisor = EXCLUDED.emisor,
    interes = EXCLUDED.interes,
    dias = EXCLUDED.dias,
    amortizacion = EXCLUDED.amortizacion,
    valor_residual = EXCLUDED.valor_residual,
    moneda_pago = EXCLUDED.moneda_pago,
    cupon = EXCLUDED.cupon,
    updated_at = NOW();

-- Insertar precio de ejemplo en last_prices (opcional, para mostrar datos completos)
INSERT INTO last_prices (
    id,
    symbol,
    last,
    change,
    ytm,
    duration_y,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'S30S5',
    95.50,  -- Precio de $95.50 ARS
    0.0125,  -- Variación del +1.25%
    0.0525,  -- YTM del 5.25%
    4.8,  -- Duración de 4.8 años
    NOW(),
    NOW()
) ON CONFLICT (symbol) DO UPDATE SET
    last = EXCLUDED.last,
    change = EXCLUDED.change,
    ytm = EXCLUDED.ytm,
    duration_y = EXCLUDED.duration_y,
    updated_at = NOW();
