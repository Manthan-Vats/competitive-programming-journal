-- 015: Audit hardening (Session #19).
-- 1) Child INSERT policies now also require the PARENT row to belong to the caller, closing a
--    cross-tenant attach gap: previously a user could insert a solution / timing session / analysis
--    / review card pointing at ANOTHER user's problem (if they learned its UUID) as long as the
--    child row's own user_id was theirs. The web app only ever inserts against own problems and the
--    extension uses the service role (RLS-exempt), so this changes no legitimate flow.
-- 2) NOT NULL on the visibility/feature booleans (they already default false; this removes the
--    nullable schema smell so `is_public = true` logic can't meet a stray NULL).
-- 3) A format CHECK on profile.username so `/u/<handle>` can't be fed slashes/spaces (NOT VALID so
--    it governs new/updated rows without failing on any legacy value).
-- Idempotent.

--  1) parent-ownership on child INSERTs
DROP POLICY IF EXISTS own_insert ON solutions;
CREATE POLICY own_insert ON solutions FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM problems p WHERE p.id = problem_id AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS own_insert ON timing_sessions;
CREATE POLICY own_insert ON timing_sessions FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM problems p WHERE p.id = problem_id AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS own_insert ON ai_analyses;
CREATE POLICY own_insert ON ai_analyses FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM solutions s WHERE s.id = solution_id AND s.user_id = (select auth.uid())
    )
  );

-- review_cards uses a single FOR ALL policy; rebuild it with the parent-ownership check on writes.
DROP POLICY IF EXISTS own_rows ON review_cards;
CREATE POLICY own_rows ON review_cards FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM problems p WHERE p.id = problem_id AND p.user_id = (select auth.uid())
    )
  );

--  2) NOT NULL on visibility / feature flags
UPDATE problems  SET is_public   = false WHERE is_public   IS NULL;
UPDATE problems  SET is_featured = false WHERE is_featured IS NULL;
UPDATE solutions SET is_public_code = false WHERE is_public_code IS NULL;

ALTER TABLE problems  ALTER COLUMN is_public      SET NOT NULL;
ALTER TABLE problems  ALTER COLUMN is_featured    SET NOT NULL;
ALTER TABLE solutions ALTER COLUMN is_public_code SET NOT NULL;

--  3) username format constraint
ALTER TABLE profile DROP CONSTRAINT IF EXISTS profile_username_format;
ALTER TABLE profile ADD CONSTRAINT profile_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_-]{1,39}$') NOT VALID;
