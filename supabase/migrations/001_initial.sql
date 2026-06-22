-- Problems
CREATE TABLE problems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url           TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  platform      TEXT NOT NULL,
  platform_id   TEXT,
  difficulty_raw TEXT,
  difficulty_norm TEXT DEFAULT 'unknown',  -- easy|medium|hard|expert|unknown
  source_tags   TEXT[] DEFAULT '{}',
  custom_tags   TEXT[] DEFAULT '{}',
  is_featured   BOOLEAN DEFAULT FALSE,
  is_public     BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Solutions
CREATE TABLE solutions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id    UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language      TEXT NOT NULL,             -- cpp|python|java|go|rust|js|other
  code          TEXT NOT NULL,
  label         TEXT,
  is_public_code BOOLEAN DEFAULT TRUE,
  ai_status     TEXT DEFAULT 'none',       -- none|pending|done|failed
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- AI Analyses
CREATE TABLE ai_analyses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id    UUID NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  algorithms     TEXT[] DEFAULT '{}',
  data_structures TEXT[] DEFAULT '{}',
  techniques     TEXT[] DEFAULT '{}',
  math_concepts  TEXT[] DEFAULT '{}',
  confidence     TEXT DEFAULT 'medium',
  raw_response   JSONB,
  model_used     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Timing Sessions
CREATE TABLE timing_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id   UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  is_manual    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Profile (single row)
CREATE TABLE profile (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  TEXT,
  bio           TEXT,
  cf_handle     TEXT,
  lc_handle     TEXT,
  ac_handle     TEXT,
  github_handle TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_problems_platform   ON problems(platform);
CREATE INDEX idx_problems_created_at ON problems(created_at DESC);
CREATE INDEX idx_problems_tags_src   ON problems USING GIN(source_tags);
CREATE INDEX idx_problems_tags_cust  ON problems USING GIN(custom_tags);
CREATE INDEX idx_solutions_problem   ON solutions(problem_id);
CREATE INDEX idx_timing_problem      ON timing_sessions(problem_id);
CREATE INDEX idx_ai_algorithms       ON ai_analyses USING GIN(algorithms);

-- Trigger to auto-update updated_at on modify
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_problems_updated_at
BEFORE UPDATE ON problems
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_solutions_updated_at
BEFORE UPDATE ON solutions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON problems FOR SELECT USING (is_public = true);
CREATE POLICY "admin_all"   ON problems USING (auth.uid() IS NOT NULL);

ALTER TABLE solutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON solutions FOR SELECT USING (
  is_public_code = true AND
  EXISTS (SELECT 1 FROM problems WHERE id = problem_id AND is_public = true)
);
CREATE POLICY "admin_all" ON solutions USING (auth.uid() IS NOT NULL);

ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON ai_analyses FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM solutions s
    JOIN problems p ON p.id = s.problem_id
    WHERE s.id = solution_id AND s.is_public_code = true AND p.is_public = true
  )
);
CREATE POLICY "admin_all" ON ai_analyses USING (auth.uid() IS NOT NULL);

ALTER TABLE timing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON timing_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM problems WHERE id = problem_id AND is_public = true)
);
CREATE POLICY "admin_all" ON timing_sessions USING (auth.uid() IS NOT NULL);

ALTER TABLE profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON profile FOR SELECT USING (true);
CREATE POLICY "admin_all"   ON profile USING (auth.uid() IS NOT NULL);
