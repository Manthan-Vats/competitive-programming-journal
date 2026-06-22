-- 014: Consolidate RLS policies (resolves the `multiple_permissive_policies` performance advisor).
-- Each of these tables had TWO permissive policies overlapping on SELECT for `authenticated`:
--   own_rows    (FOR ALL  TO authenticated)            -- includes SELECT
--   public_read (FOR SELECT TO anon, authenticated)    -- the public subset
-- Postgres must evaluate BOTH on every authenticated SELECT. We replace the FOR ALL policy with
-- explicit per-command WRITE policies and a SINGLE combined SELECT policy (public OR owner), so
-- there is exactly one permissive policy per (role, action). Semantics are UNCHANGED:
--   • anon SELECT      -> public rows only (auth.uid() is null, so the owner term is false)
--   • authenticated SELECT -> own rows OR public rows (same as before, OR'd)
--   • INSERT/UPDATE/DELETE -> owner only
-- The public conditions are copied verbatim from the existing public_read policies.
-- Wrapped in a transaction so RLS is never half-defined. Idempotent.

BEGIN;

--  problems
DROP POLICY IF EXISTS own_rows ON problems;
DROP POLICY IF EXISTS public_read ON problems;
DROP POLICY IF EXISTS read ON problems;
DROP POLICY IF EXISTS own_insert ON problems;
DROP POLICY IF EXISTS own_update ON problems;
DROP POLICY IF EXISTS own_delete ON problems;
CREATE POLICY read ON problems FOR SELECT TO anon, authenticated
  USING (is_public = true OR (select auth.uid()) = user_id);
CREATE POLICY own_insert ON problems FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_update ON problems FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_delete ON problems FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

--  solutions
DROP POLICY IF EXISTS own_rows ON solutions;
DROP POLICY IF EXISTS public_read ON solutions;
DROP POLICY IF EXISTS read ON solutions;
DROP POLICY IF EXISTS own_insert ON solutions;
DROP POLICY IF EXISTS own_update ON solutions;
DROP POLICY IF EXISTS own_delete ON solutions;
CREATE POLICY read ON solutions FOR SELECT TO anon, authenticated
  USING (
    (is_public_code = true AND EXISTS (
      SELECT 1 FROM problems WHERE problems.id = solutions.problem_id AND problems.is_public = true
    ))
    OR (select auth.uid()) = user_id
  );
CREATE POLICY own_insert ON solutions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_update ON solutions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_delete ON solutions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

--  ai_analyses
DROP POLICY IF EXISTS own_rows ON ai_analyses;
DROP POLICY IF EXISTS public_read ON ai_analyses;
DROP POLICY IF EXISTS read ON ai_analyses;
DROP POLICY IF EXISTS own_insert ON ai_analyses;
DROP POLICY IF EXISTS own_update ON ai_analyses;
DROP POLICY IF EXISTS own_delete ON ai_analyses;
CREATE POLICY read ON ai_analyses FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solutions s
      JOIN problems p ON p.id = s.problem_id
      WHERE s.id = ai_analyses.solution_id AND s.is_public_code = true AND p.is_public = true
    )
    OR (select auth.uid()) = user_id
  );
CREATE POLICY own_insert ON ai_analyses FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_update ON ai_analyses FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_delete ON ai_analyses FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

--  timing_sessions
DROP POLICY IF EXISTS own_rows ON timing_sessions;
DROP POLICY IF EXISTS public_read ON timing_sessions;
DROP POLICY IF EXISTS read ON timing_sessions;
DROP POLICY IF EXISTS own_insert ON timing_sessions;
DROP POLICY IF EXISTS own_update ON timing_sessions;
DROP POLICY IF EXISTS own_delete ON timing_sessions;
CREATE POLICY read ON timing_sessions FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM problems WHERE problems.id = timing_sessions.problem_id AND problems.is_public = true
    )
    OR (select auth.uid()) = user_id
  );
CREATE POLICY own_insert ON timing_sessions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_update ON timing_sessions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_delete ON timing_sessions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

--  profile (public_read was `true` -> everyone may read all profiles)
DROP POLICY IF EXISTS own_rows ON profile;
DROP POLICY IF EXISTS public_read ON profile;
DROP POLICY IF EXISTS read ON profile;
DROP POLICY IF EXISTS own_insert ON profile;
DROP POLICY IF EXISTS own_update ON profile;
DROP POLICY IF EXISTS own_delete ON profile;
CREATE POLICY read ON profile FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY own_insert ON profile FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_update ON profile FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_delete ON profile FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

COMMIT;
