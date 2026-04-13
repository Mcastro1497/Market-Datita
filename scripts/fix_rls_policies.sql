-- Disable RLS for public data tables or add proper policies
-- These tables contain public financial data that should be accessible without authentication

-- Option 1: Disable RLS completely for public data tables
ALTER TABLE soberanos_ars_flows DISABLE ROW LEVEL SECURITY;
ALTER TABLE soberanos_ars_details DISABLE ROW LEVEL SECURITY;

-- Option 2: If RLS must stay enabled, add policies for public read access
-- ALTER TABLE soberanos_ars_flows ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE soberanos_ars_details ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow public read access to soberanos_ars_flows" 
--   ON soberanos_ars_flows FOR SELECT 
--   USING (true);

-- CREATE POLICY "Allow public read access to soberanos_ars_details" 
--   ON soberanos_ars_details FOR SELECT 
--   USING (true);
