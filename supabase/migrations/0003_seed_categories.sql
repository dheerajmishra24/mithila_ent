-- Seed script to populate all core fabric categories
INSERT INTO categories (name, slug) VALUES 
('Pure Linen', 'linen'),
('Woven Cotton', 'cotton'),
('Fluid Viscose', 'viscose'),
('Brushed Flannel', 'flannel'),
('Wale Corduroy', 'corduroy'),
('Diagonal Twill', 'twill'),
('Faux Suede', 'suede'),
('Pile Velvet', 'velvet'),
('Virgin Wool', 'wool'),
('Thermal Fleece', 'fleece'),
('Heritage Tweed', 'tweed')
ON CONFLICT (slug) DO NOTHING;
