-- Atomic Inventory Deduction to prevent Race Conditions
CREATE OR REPLACE FUNCTION decrement_inventory_atomic(variant_id UUID, quantity_to_deduct INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Lock the row for update
  SELECT stock_quantity INTO current_stock
  FROM product_variants
  WHERE id = variant_id
  FOR UPDATE;

  -- Check if enough stock exists
  IF current_stock >= quantity_to_deduct THEN
    -- Deduct
    UPDATE product_variants
    SET stock_quantity = stock_quantity - quantity_to_deduct
    WHERE id = variant_id;
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;
