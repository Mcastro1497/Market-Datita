-- Apply the same RLS policies as the working tables (ons_flows, ons_details, soberanos_flows, soberanos_details)
-- These policies allow public read access to financial data

-- Enable RLS on both tables
ALTER TABLE soberanos_ars_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE soberanos_ars_details ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to soberanos_ars_flows" ON soberanos_ars_flows;
DROP POLICY IF EXISTS "Allow public read access to soberanos_ars_details" ON soberanos_ars_details;
DROP POLICY IF EXISTS "Allow all operations on soberanos_ars_flows" ON soberanos_ars_flows;
DROP POLICY IF EXISTS "Allow all operations on soberanos_ars_details" ON soberanos_ars_details;

-- Create policies that allow all operations (same as the working tables)
CREATE POLICY "Allow all operations on soberanos_ars_flows" 
  ON soberanos_ars_flows 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all operations on soberanos_ars_details" 
  ON soberanos_ars_details 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
