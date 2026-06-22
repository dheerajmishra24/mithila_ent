-- Security hardening.

-- 1) Auto-create a profile row for every new auth user, and backfill existing
--    ones. Without this, profiles stay empty: role lookups fail and admins
--    cannot see customer names on orders.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2) Let admins read all profiles (is_admin() is SECURITY DEFINER, so no RLS
--    recursion). Combined with the existing "own profile" policy.
DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
CREATE POLICY "Admins read all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- 3) Pin search_path on SECURITY DEFINER functions (prevents search_path
--    hijacking). Wrapped so a missing function never fails the migration.
DO $$ BEGIN
  ALTER FUNCTION create_order_atomic(jsonb, jsonb, text, numeric, numeric) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION decrement_inventory_atomic(uuid, integer) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION checkout_processor(uuid, uuid, jsonb, text) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 4) Stop discount-code enumeration. The previous "public read active discounts"
--    policy let anyone SELECT every active coupon. Remove it and validate codes
--    through a SECURITY DEFINER function that only ever reveals the one code asked for.
DROP POLICY IF EXISTS "Public read active discounts" ON discounts;

CREATE OR REPLACE FUNCTION validate_discount(p_code TEXT, p_subtotal NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := NULLIF(upper(trim(COALESCE(p_code, ''))), '');
  d RECORD;
  v_amount NUMERIC(10,2) := 0;
BEGIN
  IF v_code IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Enter a discount code.');
  END IF;

  SELECT * INTO d FROM discounts
   WHERE code = v_code
     AND is_active = true
     AND (starts_at IS NULL OR starts_at <= now())
     AND (ends_at IS NULL OR ends_at >= now())
     AND (max_uses IS NULL OR current_uses < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive code.');
  END IF;

  IF d.min_order_value IS NOT NULL AND p_subtotal < d.min_order_value THEN
    RETURN jsonb_build_object('valid', false, 'error',
      'Requires a minimum order of ₹' || floor(d.min_order_value)::text || '.');
  END IF;

  IF d.type = 'percentage' THEN
    v_amount := round(p_subtotal * d.value / 100, 2);
  ELSIF d.type = 'fixed_amount' THEN
    v_amount := LEAST(d.value, p_subtotal);
  ELSIF d.type = 'free_shipping' THEN
    v_amount := 50;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_code,
    'type', d.type,
    'value', d.value,
    'discountAmount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION validate_discount(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_discount(TEXT, NUMERIC) TO anon, authenticated;
