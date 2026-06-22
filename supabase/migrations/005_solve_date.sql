-- 005: Real solve/AC date for problems.
-- Until now problems were dated only by `created_at` (DEFAULT NOW() = row-insert time),
-- so bulk-imported problems all collapsed onto the import day and the heatmap/streaks
-- reflected when a row was inserted, not when the problem was actually solved. We add a
-- nullable `solved_at` populated from the judge's own timestamp (Codeforces
-- `creationTimeSeconds`, LeetCode submission `timestamp`) on capture/import, and editable
-- on manual add. The UI falls back to `created_at` when `solved_at` is NULL.
-- Idempotent + additive (nullable column): safe to run on an existing database.

ALTER TABLE problems ADD COLUMN IF NOT EXISTS solved_at TIMESTAMPTZ;

COMMENT ON COLUMN problems.solved_at IS
  'Actual solve/AC time reported by the judge (CF creationTimeSeconds, LC submission timestamp). NULL when unknown; the app falls back to created_at for display/sort.';

-- Sort/scan support for "newest solved first" per user (NULLs last so undated rows sink).
CREATE INDEX IF NOT EXISTS idx_problems_user_solved_at
  ON problems (user_id, solved_at DESC NULLS LAST);
