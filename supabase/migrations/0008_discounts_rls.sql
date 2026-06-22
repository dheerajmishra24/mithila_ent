-- RLS policies for the discounts table.
--
-- 0000_initial_schema.sql enabled RLS on `discounts` but never defined any
-- policy, so the default-deny applied and NOBODY (not even admins) could read
-- or write discounts. This restores the intended behaviour:
--   * admins have full control (create / edit / delete),
--   * active discount codes are publicly readable so checkout can validate them.

DROP POLICY IF EXISTS "Admin manage discounts" ON discounts;
DROP POLICY IF EXISTS "Public read active discounts" ON discounts;

CREATE POLICY "Admin manage discounts" ON discounts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Public read active discounts" ON discounts
  FOR SELECT USING (is_active = true);
