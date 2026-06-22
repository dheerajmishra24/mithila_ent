-- Persistent store settings (singleton row).
-- A single-row table keyed by a boolean PK so there is always exactly one row.

CREATE TABLE IF NOT EXISTS store_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  store_name TEXT NOT NULL DEFAULT 'Mithila Enterprises',
  support_email TEXT NOT NULL DEFAULT 'support@mithilaenterprises.com',
  support_phone TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT store_settings_singleton CHECK (id)
);

-- Seed the singleton row.
INSERT INTO store_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read settings" ON store_settings;
DROP POLICY IF EXISTS "Admin manage settings" ON store_settings;

-- Store name / contact are public (used by the storefront); only admins can edit.
CREATE POLICY "Public read settings" ON store_settings
  FOR SELECT USING (true);

CREATE POLICY "Admin manage settings" ON store_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
