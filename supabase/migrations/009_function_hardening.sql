-- 009: Function + privilege hardening (resolves Supabase security advisors).
-- Surfaced by the live `get_advisors(security)` scan (session #11):
--   1. function_search_path_mutable - `update_updated_at`, `check_rate_limit`, `prune_rate_limits`
--      have no pinned search_path. A function without a fixed search_path resolves unqualified
--      names against the CALLER's session search_path, which a caller can manipulate to shadow
--      objects. Best practice: pin `search_path = ''` and schema-qualify every non-catalog object
--      (pg_catalog is always searched implicitly, so built-ins like now()/random() still resolve).
--   2. anon/authenticated security_definer executable - `rls_auto_enable()` (the SECURITY DEFINER
--      event-trigger helper behind the `ensure_rls` trigger that auto-enables RLS on new public
--      tables) was granted EXECUTE to PUBLIC, so anon/authenticated could call it via
--      /rest/v1/rpc/rls_auto_enable. The event trigger fires it regardless of EXECUTE grants, so
--      revoking direct EXECUTE is safe and closes the finding. (Calling it directly would error
--      anyway - pg_event_trigger_ddl_commands() only works inside an event-trigger context.)
-- Idempotent: CREATE OR REPLACE / ALTER / REVOKE are all safe to re-run. Behaviour of every
-- function is unchanged - only the resolution path and a stray PUBLIC grant change.

-- 1a. Trigger function: no non-catalog references in its body, so just pin the path.
ALTER FUNCTION public.update_updated_at() SET search_path = '';

-- 1b. Rate-limit functions: recreate with a pinned empty search_path and a fully-qualified
--     reference to public.rate_limits (the only non-catalog object they touch). Bodies are
--     otherwise identical to migration 006.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_window_start timestamptz;
  v_count        integer;
BEGIN
  IF random() < 0.005 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  -- Alias the conflict target so its references are unambiguous under an empty search_path
  -- (schema-qualifying the ON CONFLICT target table is not valid; an alias is the clean way).
  INSERT INTO public.rate_limits AS rl (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rl.count + 1
    WHERE rl.count < p_max
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    RETURN false; -- update filtered out -> already at the cap
  END IF;

  RETURN v_count <= p_max;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_rate_limits() RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
$$;

-- 2. Strip the stray PUBLIC EXECUTE grant on the auto-RLS event-trigger helper. The `ensure_rls`
--    event trigger keeps working (triggers don't consult EXECUTE grants). anon/authenticated
--    inherit from PUBLIC; revoke explicitly too (no-op if not directly granted).
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
EXCEPTION
  WHEN undefined_object THEN NULL; -- roles absent on a non-Supabase Postgres
END $$;

-- Document the intentional advisor INFO on rate_limits (RLS on, no policy = service-role only).
COMMENT ON TABLE public.rate_limits IS
  'RLS enabled with NO policies on purpose: only the service-role (RLS-bypassing) client may read/write. See lib/rate-limit.ts.';
