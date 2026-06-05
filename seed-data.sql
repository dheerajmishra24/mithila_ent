-- This script directly inserts dummy fabrics into your Supabase database.
-- Because it runs directly in the SQL editor, it bypasses the RLS recursion error completely.

-- 1. Insert Categories
INSERT INTO categories (id, slug, name) VALUES 
('c1000000-0000-0000-0000-000000000001', 'fabric', 'Fabric'),
('c2000000-0000-0000-0000-000000000002', 'stitched-wear', 'Stitched Wear'),
('c3000000-0000-0000-0000-000000000003', 'saree', 'Saree')
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert Products
INSERT INTO products (id, category_id, slug, title, description, weave, gsm, is_featured, tags, status) VALUES 
('p1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'hand-spun-cotton-tunic', 'Hand-spun Cotton Tunic', 'Premium hand-spun cotton tunic featuring intricate Jamdani weave patterns.', 'Jamdani', 150, true, ARRAY['cotton', 'stitched'], 'active'),
('p2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'raw-silk-yardage', 'Raw Silk Yardage', 'Pure, unbleached Tussar silk yardage. Loomed by heritage artisans.', 'Tussar', 120, false, ARRAY['silk'], 'active'),
('p3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'botanical-dyed-linen', 'Botanical Dyed Linen', 'Highly breathable linen, dyed using fermented indigo plants.', 'Plain', 180, true, ARRAY['linen'], 'active'),
('p4000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'organic-cotton-weave', 'Organic Cotton Weave', 'GOTS certified organic cotton woven in a soft satin finish.', 'Satin', 160, false, ARRAY['cotton'], 'active')
ON CONFLICT (slug) DO NOTHING;

-- 3. Insert Product Variants
INSERT INTO product_variants (product_id, sku, color, price, stock_quantity, images) VALUES 
('p1000000-0000-0000-0000-000000000001', 'SKU-001', 'Crimson Red', 1200, 10, ARRAY['https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop']),
('p2000000-0000-0000-0000-000000000002', 'SKU-002', 'Natural Ecru', 850, 25, ARRAY['https://images.unsplash.com/photo-1605289982774-9a6fef564df8?q=80&w=600&auto=format&fit=crop']),
('p3000000-0000-0000-0000-000000000003', 'SKU-003', 'Indigo Blue', 1450, 5, ARRAY['https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?q=80&w=600&auto=format&fit=crop']),
('p4000000-0000-0000-0000-000000000004', 'SKU-004', 'Turmeric Yellow', 950, 40, ARRAY['https://images.unsplash.com/photo-1584346747551-5120352fb387?q=80&w=600&auto=format&fit=crop'])
ON CONFLICT (sku) DO NOTHING;
