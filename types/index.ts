export type Platform =
  | "codeforces"
  | "leetcode"
  | "atcoder"
  | "spoj"
  | "cses"
  | "hackerrank"
  | "hackerearth"
  | "codechef"
  | "other";

export type Language = "cpp" | "python" | "java" | "go" | "rust" | "js" | "other";

export type DifficultyNorm = "easy" | "medium" | "hard" | "expert" | "unknown";

export type AIStatus = "none" | "pending" | "done" | "failed";

export interface Problem {
  id: string;
  url: string;
  title: string;
  platform: Platform;
  platform_id: string | null;
  difficulty_raw: string | null;
  difficulty_norm: DifficultyNorm;
  source_tags: string[];
  custom_tags: string[];
  is_featured: boolean;
  is_public: boolean;
  notes: string | null;
  statement: string | null;
  metadata: ProblemMetadata;
  solved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Flexible per-problem metadata captured by the extension (all optional). Stored as
// JSONB; everything here is best-effort and may be absent depending on the judge/page.
export interface ProblemMetadata {
  timeLimit?: string;
  memoryLimit?: string;
  ratingSource?: string;
  [key: string]: unknown;
}

export interface Solution {
  id: string;
  problem_id: string;
  language: Language;
  code: string;
  label: string | null;
  is_public_code: boolean;
  ai_status: AIStatus;
  // Provenance (migration 008): where this submission came from. All nullable - manual
  // entries have no provenance; deep-imported submissions carry the judge's metadata.
  submitted_at: string | null;
  verdict: string | null;
  is_accepted: boolean | null;
  runtime: string | null;
  memory: string | null;
  submission_url: string | null;
  source_submission_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIAnalysis {
  id: string;
  solution_id: string;
  algorithms: string[];
  data_structures: string[];
  techniques: string[];
  math_concepts: string[];
  confidence: "high" | "medium" | "low";
  raw_response: any;
  model_used: string | null;
  created_at: string;
}

export interface TimingSession {
  id: string;
  problem_id: string;
  started_at: string;
  ended_at: string | null;
  is_manual: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  cf_handle: string | null;
  lc_handle: string | null;
  ac_handle: string | null;
  github_handle: string | null;
  updated_at: string;
}

export type SolutionWithRelations = Solution & {
  ai_analyses?: AIAnalysis[];
};

export type ProblemWithRelations = Problem & {
  solutions: SolutionWithRelations[];
  timing_sessions: TimingSession[];
  total_seconds: number; // computed
  ai_tags: string[];     // computed
};

export type DailyActivity = {
  date: string;
  count: number;
};

export type TopicStat = {
  topic: string;
  count: number;
  avg_seconds: number;
};

export interface AnalyticsSummary {
  total_problems: number;
  total_seconds: number;
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
  platform_distribution: Record<Platform, number>;
  difficulty_distribution: Record<DifficultyNorm, number>;
  language_distribution: Record<Language, number>;
  topic_distribution: TopicStat[];
  activity: DailyActivity[];
}
