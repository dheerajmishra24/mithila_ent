ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert and update on auth_attempts" 
ON auth_attempts FOR ALL USING (true) WITH CHECK (true);
