-- 017: Cache for AI revision assists (hint / critique / pattern_card).
-- Each assist used to call the model on EVERY click - so reviewing the same problem day after day
-- (the whole point of spaced repetition) re-spent the user's Gemini quota and added 2-5s latency
-- for an answer that almost never changes. We now persist the generated result here, keyed by
-- (problem_id, action), and serve repeats straight from the DB (instant, free). A new model call
-- happens only on a cache MISS or an explicit "regenerate".
--
-- `solution_hash` is a sha256 of the solution code that critique/pattern_card were generated from
-- (NULL for hint, which depends only on the problem, not the code). If the user later edits their
-- solution the hash no longer matches and the route regenerates automatically - so the cache can
-- never show stale feedback for code that has since changed.
--
-- PRIVATE: per-user only, mirrors review_cards (no public_read). Idempotent.

CREATE TABLE IF NOT EXISTS ai_assists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id    uuid NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  action        text NOT NULL CHECK (action IN ('hint', 'critique', 'pattern_card')),
  solution_hash text,                            -- sha256 of the code for critique/pattern_card; NULL for hint
  result        jsonb NOT NULL,                  -- the generated assist payload (HintResult / CritiqueResult / PatternCardResult)
  model_used    text,                            -- model that produced it (after any provider fallback)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (problem_id, action)                    -- one cached result per action per problem
);

ALTER TABLE ai_assists ENABLE ROW LEVEL SECURITY;

-- Per-user isolation; private. Writes also require the parent problem to belong to the caller
-- (mirrors the parent-ownership hardening in migration 015 so a known problem UUID owned by another
-- user can't be used to seed cache rows).
DROP POLICY IF EXISTS own_rows ON ai_assists;
CREATE POLICY own_rows ON ai_assists
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM problems p WHERE p.id = problem_id AND p.user_id = (select auth.uid())
    )
  );

-- Cache lookups go by (problem_id, action); the UNIQUE constraint already provides that index.
-- This one covers ON DELETE CASCADE cleanup + per-user listing.
CREATE INDEX IF NOT EXISTS idx_ai_assists_user ON ai_assists (user_id);

DROP TRIGGER IF EXISTS update_ai_assists_updated_at ON ai_assists;
CREATE TRIGGER update_ai_assists_updated_at
  BEFORE UPDATE ON ai_assists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
