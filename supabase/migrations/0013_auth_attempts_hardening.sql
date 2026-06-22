-- Lock down auth_attempts.
-- The login flow is unauthenticated, so the table previously had a fully public
-- RLS policy (anyone could read/alter every row). Replace that with SECURITY
-- DEFINER functions: the table becomes default-deny for direct access, and the
-- login action only ever touches it through these vetted functions.

DROP POLICY IF EXISTS "Allow public insert and update on auth_attempts" ON auth_attempts;
-- RLS stays ENABLED with no policies => no direct client access.

-- Is this email currently locked out?
CREATE OR REPLACE FUNCTION auth_attempt_is_locked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
BEGIN
  SELECT locked_until INTO v_locked_until
  FROM auth_attempts
  WHERE email = lower(trim(p_email))
  ORDER BY last_attempt DESC
  LIMIT 1;

  RETURN v_locked_until IS NOT NULL AND v_locked_until > now();
END;
$$;

-- Record a failed attempt; lock for p_lock_minutes once attempts reach p_max.
-- Returns { attempts, locked, justLocked } so the caller can send one alert email.
CREATE OR REPLACE FUNCTION auth_attempt_record_failure(
  p_email TEXT,
  p_max INTEGER DEFAULT 5,
  p_lock_minutes INTEGER DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_id UUID;
  v_attempts INTEGER;
  v_locked BOOLEAN := false;
  v_just_locked BOOLEAN := false;
BEGIN
  SELECT id, attempts INTO v_id, v_attempts
  FROM auth_attempts
  WHERE email = v_email
  ORDER BY last_attempt DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO auth_attempts (email, attempts, last_attempt)
    VALUES (v_email, 1, now());
    v_attempts := 1;
  ELSE
    v_attempts := v_attempts + 1;
    UPDATE auth_attempts SET attempts = v_attempts, last_attempt = now() WHERE id = v_id;
  END IF;

  IF v_attempts >= p_max THEN
    v_locked := true;
    v_just_locked := (v_attempts = p_max);
    UPDATE auth_attempts
       SET locked_until = now() + make_interval(mins => p_lock_minutes)
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('attempts', v_attempts, 'locked', v_locked, 'justLocked', v_just_locked);
END;
$$;

-- Clear the failure counter on a successful login.
CREATE OR REPLACE FUNCTION auth_attempt_clear(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth_attempts WHERE email = lower(trim(p_email));
END;
$$;

REVOKE ALL ON FUNCTION auth_attempt_is_locked(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_attempt_is_locked(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION auth_attempt_record_failure(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_attempt_record_failure(TEXT, INTEGER, INTEGER) TO anon, authenticated;
REVOKE ALL ON FUNCTION auth_attempt_clear(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_attempt_clear(TEXT) TO anon, authenticated;
