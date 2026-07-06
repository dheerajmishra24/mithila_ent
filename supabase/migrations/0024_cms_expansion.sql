-- Insert new CMS sections defined in the new dashboard schema
INSERT INTO site_content (key, title, body) VALUES
  ('home_features', '', ''),
  ('home_cta', '', ''),
  ('about_mission', '', ''),
  ('about_heritage', '', ''),
  ('shop_header', '', '')
ON CONFLICT (key) DO NOTHING;
