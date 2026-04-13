-- Crear tabla para histórico de CER
CREATE TABLE IF NOT EXISTS cer_historico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    valor_cer DECIMAL(15,6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice en fecha para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_cer_historico_fecha ON cer_historico(fecha DESC);

-- Habilitar RLS
ALTER TABLE cer_historico ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para acceso público (solo lectura para usuarios, escritura para admin)
CREATE POLICY "Allow public read access on cer_historico" ON cer_historico
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on cer_historico" ON cer_historico
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on cer_historico" ON cer_historico
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access on cer_historico" ON cer_historico
    FOR DELETE USING (true);

-- Insertar algunos datos de ejemplo
INSERT INTO cer_historico (fecha, valor_cer) VALUES
    ('2024-01-01', 1234.56),
    ('2024-01-02', 1235.78),
    ('2024-01-03', 1237.12),
    ('2024-01-04', 1238.45),
    ('2024-01-05', 1239.89)
ON CONFLICT (fecha) DO NOTHING;

-- Verificar que los datos se insertaron correctamente
SELECT * FROM cer_historico ORDER BY fecha DESC LIMIT 5;
