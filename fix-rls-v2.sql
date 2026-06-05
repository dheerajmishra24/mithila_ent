-- 1. Drop ALL policies on profiles just to be absolutely sure there are no leftover recursive policies
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;

-- 2. Recreate simple policies without any is_admin() calls
CREATE POLICY "Users view own profile" ON profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- 3. Update the is_admin function to completely bypass RLS internally
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;
