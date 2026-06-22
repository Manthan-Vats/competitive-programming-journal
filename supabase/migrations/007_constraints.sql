-- 007: Database-level integrity constraints (defense-in-depth under the app validation).
-- The app already allowlists these enums (lib/difficulty.ts) and validates timing order, but
-- the DB had only free TEXT columns (audit P1-7) - a bug or a direct service-role write could
-- still store garbage. These CHECK constraints make the database itself reject invalid enum
-- values and backwards time ranges.
-- All constraints are added NOT VALID: Postgres enforces them on every INSERT/UPDATE going
-- forward but does NOT scan existing rows, so the migration can't fail on legacy data and
-- takes no heavy lock. Once you've confirmed existing data is clean you may run, per
-- constraint: `ALTER TABLE <t> VALIDATE CONSTRAINT <name>;` (cheap, no rewrite).
-- Idempotent: guarded so re-running is safe.

BEGIN;

DO $$
BEGIN
  -- problems.platform
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'problems_platform_check') THEN
    ALTER TABLE problems ADD CONSTRAINT problems_platform_check
      CHECK (platform IN (
        'codeforces','leetcode','atcoder','spoj','cses',
        'hackerrank','hackerearth','codechef','other'
      )) NOT VALID;
  END IF;

  -- problems.difficulty_norm
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'problems_difficulty_norm_check') THEN
    ALTER TABLE problems ADD CONSTRAINT problems_difficulty_norm_check
      CHECK (difficulty_norm IN ('easy','medium','hard','expert','unknown')) NOT VALID;
  END IF;

  -- solutions.language
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solutions_language_check') THEN
    ALTER TABLE solutions ADD CONSTRAINT solutions_language_check
      CHECK (language IN ('cpp','python','java','go','rust','js','other')) NOT VALID;
  END IF;

  -- solutions.ai_status
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solutions_ai_status_check') THEN
    ALTER TABLE solutions ADD CONSTRAINT solutions_ai_status_check
      CHECK (ai_status IN ('none','pending','done','failed')) NOT VALID;
  END IF;

  -- ai_analyses.confidence
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_confidence_check') THEN
    ALTER TABLE ai_analyses ADD CONSTRAINT ai_analyses_confidence_check
      CHECK (confidence IN ('high','medium','low')) NOT VALID;
  END IF;

  -- timing_sessions: a session can't end before it starts (open sessions have NULL ended_at).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timing_sessions_order_check') THEN
    ALTER TABLE timing_sessions ADD CONSTRAINT timing_sessions_order_check
      CHECK (ended_at IS NULL OR ended_at >= started_at) NOT VALID;
  END IF;
END $$;

COMMIT;
