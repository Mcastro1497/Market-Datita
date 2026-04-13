-- Drop existing ARS tables and recreate them with the exact structure of the original soberanos tables

-- Drop existing tables
DROP TABLE IF EXISTS public.soberanos_ars_details;
DROP TABLE IF EXISTS public.soberanos_ars_flows;

-- Create soberanos_ars_details table with the same structure as soberanos_details
CREATE TABLE public.soberanos_ars_details (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker text,
    legislacion text,
    jurisdiccion_pago text,
    calleable boolean,
    lamina_minima numeric,
    fecha_vencimiento date,
    moneda text,
    monto_residual numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create soberanos_ars_flow table with the same structure as soberanos_flows
CREATE TABLE public.soberanos_ars_flow (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker text,
    dias integer,
    moneda_denominacion text,
    cupon numeric,
    fecha_pago date,
    total numeric,
    interes numeric,
    moneda_pago text,
    amortizacion numeric,
    emisor text,
    valor_residual numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.soberanos_ars_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soberanos_ars_flow ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on soberanos_ars_details" ON public.soberanos_ars_details
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on soberanos_ars_flow" ON public.soberanos_ars_flow
    FOR ALL USING (true) WITH CHECK (true);
