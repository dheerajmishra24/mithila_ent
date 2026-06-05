-- Add technical detail columns to the products table
ALTER TABLE products 
ADD COLUMN width TEXT DEFAULT '54 inches / 137 cm',
ADD COLUMN stretch TEXT DEFAULT '0% Mechanical Stretch',
ADD COLUMN origin TEXT DEFAULT 'Mithila Artisanal Cluster, India',
ADD COLUMN best_suited_for TEXT[] DEFAULT ARRAY['Tailored overcoats', 'Unlined summer blazers', 'Dense upholstery'];
