-- 012: Revision / spaced-repetition cards (P4).
-- One FSRS card per (user, problem). A problem with NO row here is a "new" card (never reviewed);
-- the queue surfaces due rows + a capped number of new problems. `suspended` is the per-problem
-- opt-out. The full ts-fsrs Card lives in `fsrs` (jsonb, dates as ISO strings - ts-fsrs accepts
-- string dates on the way back in); `due`/`state`/`reps`/`lapses`/`last_review`/`last_rating` are
-- denormalized from it for fast queue queries + display. PRIVATE: no public_read policy - revision
-- progress is personal. Idempotent.

CREATE TABLE IF NOT EXISTS review_cards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id   uuid NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  fsrs         jsonb NOT NULL,                  -- full ts-fsrs Card (ISO date strings)
  due          timestamptz NOT NULL,            -- denormalized fsrs.due (queue ordering)
  state        smallint NOT NULL DEFAULT 0,     -- ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning
  reps         integer NOT NULL DEFAULT 0,
  lapses       integer NOT NULL DEFAULT 0,
  last_rating  smallint,                        -- last grade given: 1 Again..4 Easy (null = never)
  last_review  timestamptz,
  suspended    boolean NOT NULL DEFAULT false,  -- per-problem opt-out of revision
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, problem_id),
  CONSTRAINT review_cards_state_check  CHECK (state BETWEEN 0 AND 3),
  CONSTRAINT review_cards_rating_check CHECK (last_rating IS NULL OR last_rating BETWEEN 1 AND 4),
  CONSTRAINT review_cards_reps_check   CHECK (reps >= 0 AND lapses >= 0)
);

ALTER TABLE review_cards ENABLE ROW LEVEL SECURITY;

-- Per-user isolation; private (no public_read). Mirrors the own_rows policy on the other tables.
DROP POLICY IF EXISTS own_rows ON review_cards;
CREATE POLICY own_rows ON review_cards
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Queue query: this user's non-suspended cards ordered by due.
CREATE INDEX IF NOT EXISTS idx_review_cards_due
  ON review_cards (user_id, due)
  WHERE NOT suspended;

-- Find-a-problem's-card lookups.
CREATE INDEX IF NOT EXISTS idx_review_cards_problem
  ON review_cards (problem_id);

DROP TRIGGER IF EXISTS update_review_cards_updated_at ON review_cards;
CREATE TRIGGER update_review_cards_updated_at
  BEFORE UPDATE ON review_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
