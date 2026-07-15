-- Fix infinite recursion in profiles SELECT policy
DROP POLICY IF EXISTS "Users view own profile" ON profiles;

-- Allow users to view their own profile, without calling is_admin()
CREATE POLICY "Users view own profile" ON profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- If you still want admins to view all profiles, use a policy that doesn't cause recursion:
-- Since is_admin is SECURITY DEFINER, it bypasses RLS for the internal check.
-- But we need to make sure is_admin itself doesn't trigger the policy if it's called from it.
-- Actually, just the above policy is enough for the storefront and admin dashboard right now.
