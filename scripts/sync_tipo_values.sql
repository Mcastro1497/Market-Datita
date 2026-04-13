-- Consultar valores actuales de tipo en ambas tablas
SELECT 'soberanos_ars_details' as tabla, tipo, COUNT(*) as cantidad
FROM soberanos_ars_details 
WHERE tipo IS NOT NULL
GROUP BY tipo

UNION ALL

SELECT 'soberanos_ars_flows' as tabla, tipo, COUNT(*) as cantidad  
FROM soberanos_ars_flows
WHERE tipo IS NOT NULL
GROUP BY tipo
ORDER BY tabla, tipo;

-- Sincronizar el campo tipo en soberanos_ars_details para que coincida con soberanos_ars_flows
-- Basándome en el Excel, el tipo debería ser "CER" para CUAP
UPDATE soberanos_ars_details 
SET tipo = 'CER'
WHERE ticker = 'CUAP';

-- Verificar que soberanos_ars_flows también tenga el tipo correcto
UPDATE soberanos_ars_flows 
SET tipo = 'CER'
WHERE ticker = 'CUAP';

-- Consultar después de la sincronización para verificar
SELECT 'AFTER UPDATE - soberanos_ars_details' as tabla, tipo, COUNT(*) as cantidad
FROM soberanos_ars_details 
WHERE tipo IS NOT NULL
GROUP BY tipo

UNION ALL

SELECT 'AFTER UPDATE - soberanos_ars_flows' as tabla, tipo, COUNT(*) as cantidad  
FROM soberanos_ars_flows
WHERE tipo IS NOT NULL
GROUP BY tipo
ORDER BY tabla, tipo;
