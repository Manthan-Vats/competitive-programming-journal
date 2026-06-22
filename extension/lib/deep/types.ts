// Shapes for the deep import (Wave 3 Part C). The problem/solution objects mirror the web
// contract that `POST /api/ext/import` accepts (CaptureInput + migration-008 provenance),
// kept structurally in sync with lib/ext/problem-row.ts + lib/ext/solution-provenance.ts.
// The deep fetchers run in a content script on the judge's own domain (the submission APIs
// are SESSION-gated - only the logged-in browser can read them), shape raw responses into
// these items with the PURE builders in this folder, then batch-POST them to /api/ext/import
// via the background worker (which holds the per-user bearer token).

export interface DeepProblem {
  url: string;
  title: string;
  platform: string;
  platform_id?: string;
  difficulty_raw?: string;
  difficulty_norm?: string;
  source_tags?: string[];
  statement?: string;
  solved_at?: string; // ISO 8601
}

export interface DeepSolution {
  language: string; // one of SOLUTION_LANGUAGES (server re-validates)
  code: string;
  // provenance (migration 008)
  submitted_at?: string; // ISO 8601
  verdict?: string;
  is_accepted?: boolean;
  runtime?: string;
  memory?: string;
  submission_url?: string;
  source_submission_id?: string; // judge-prefixed, e.g. "cf:359178622" / "lc:514671986"
}

export interface DeepImportItem {
  problem: DeepProblem;
  solution?: DeepSolution; // omitted when the source couldn't be read
}
