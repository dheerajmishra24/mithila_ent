-- Add the two product spec columns the app already collects (admin new-product
-- form + AI extractor) and displays (product detail page), but which were never
-- in the schema. Without them, count/construction were silently dropped.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS count TEXT,
  ADD COLUMN IF NOT EXISTS construction TEXT;
