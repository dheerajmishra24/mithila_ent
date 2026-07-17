-- Migration to add print column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS print TEXT;
