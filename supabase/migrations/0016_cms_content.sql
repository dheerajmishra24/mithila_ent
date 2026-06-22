-- CMS: editable site content + featured categories.

-- Featured flag for categories (admin can highlight collections).
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Editable content blocks: legal pages, about, homepage hero, announcement bar.
CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  title TEXT,
  body TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read site content" ON site_content;
DROP POLICY IF EXISTS "Admin manage site content" ON site_content;
CREATE POLICY "Public read site content" ON site_content FOR SELECT USING (true);
CREATE POLICY "Admin manage site content" ON site_content FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Seed the editable blocks (empty body => storefront falls back to built-in copy).
INSERT INTO site_content (key, title, body) VALUES
  ('legal_privacy-policy', 'Privacy Policy', ''),
  ('legal_terms-of-service', 'Terms of Service', ''),
  ('legal_shipping-returns', 'Shipping & Returns', ''),
  ('about_intro', '', ''),
  ('home_hero', '', ''),
  ('announcement', '', '')
ON CONFLICT (key) DO NOTHING;
