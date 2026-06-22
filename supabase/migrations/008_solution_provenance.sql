-- 008: Solution provenance (data-model gap from the readiness audit).
-- Until now a `solutions` row was just code+language with no link back to the judge
-- submission it came from. Wave 3's deep import (and richer manual entry) wants to record
-- WHERE a solution came from: the actual submission's time, verdict, runtime/memory, a link,
-- and the judge's submission id. All columns are NULLABLE and additive, so this is safe to
-- run on an existing database and existing rows simply have NULL provenance.
-- runtime/memory are stored as TEXT (not parsed numerics) because each judge reports them
-- in its own unit/format (LeetCode "52 ms" / "16.1 MB", Codeforces ms, etc.) and we'd rather
-- preserve the judge's own string than lossily normalize at import time.
-- Idempotent.

ALTER TABLE solutions ADD COLUMN IF NOT EXISTS submitted_at         timestamptz;
ALTER TABLE solutions ADD COLUMN IF NOT EXISTS verdict              text;
ALTER TABLE solutions ADD COLUMN IF NOT EXISTS is_accepted          boolean;
ALTER TABLE solutions ADD COLUMN IF NOT EXISTS runtime              text;
ALTER TABLE solutions ADD COLUMN IF NOT EXISTS memory               text;
ALTER TABLE solutions ADD COLUMN IF NOT EXISTS submission_url       text;
ALTER TABLE solutions ADD COLUMN IF NOT EXISTS source_submission_id text;

COMMENT ON COLUMN solutions.submitted_at IS 'Judge submission timestamp (when the code was submitted/accepted), distinct from row created_at.';
COMMENT ON COLUMN solutions.source_submission_id IS 'The judge''s own submission id; used to dedupe re-imports of the same submission.';

-- Dedupe guard: the same judge submission can only be imported once per user. Partial unique
-- index so NULLs (manual entries with no provenance) are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_solutions_user_submission
  ON solutions (user_id, source_submission_id)
  WHERE source_submission_id IS NOT NULL;
