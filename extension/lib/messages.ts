// Message contract between content scripts / popup and the background worker.

export interface CapturePayload {
  url: string;
  title: string;
  platform: string;
  platform_id?: string;
  difficulty_raw?: string;
  difficulty_norm?: string;
  source_tags?: string[];
  statement?: string;
  metadata?: Record<string, unknown>;
}

export type ExtMessage =
  | { type: "SET_TOKEN"; token: string; apiBase: string }
  | { type: "GET_STATUS" }
  | { type: "DISCONNECT" }
  | { type: "CAPTURE"; payload: CapturePayload }
  // The gloaming. start needs the page payload; pause/resume/stop act on the stored
  // active timer. status returns a derived snapshot. One solve = one committed session.
  | { type: "TIMER"; action: "start" | "pause" | "resume" | "stop"; payload?: CapturePayload }
  | { type: "TIMER_STATE" }
  // "Is this problem already in the journal?" - for resume/on-file detection.
  | { type: "CHECK_PROBLEM"; url: string }
  | {
      type: "ATTACH_SOLUTION";
      payload: CapturePayload;
      language: string;
      code: string;
      label?: string;
    }
  // History sync (Wave 3 Part C). Triggered from the WEB APP (via the sync-bridge content script).
  // The background opens/uses a JUDGE tab and tells its content script to fetch (same-origin, so
  // the session cookies attach - a background SW fetch does NOT reliably carry them). The content
  // script gathers solved problems + source and routes them back through the background to
  // /api/ext/import. `handle` is the user's saved judge handle (CF needs it; LC's session identifies
  // the user). The web app is the UI; the extension is silent plumbing, opening the tab itself.
  | { type: "SYNC_JUDGE"; judge: "codeforces" | "leetcode"; handle?: string }
  // Sent FROM a judge content script TO the background: read the already-imported submission ids
  // (so we only fetch genuinely-new ones) and POST a batch of items to /api/ext/import.
  | { type: "IMPORT_EXISTING_IDS" }
  | { type: "IMPORT_BATCH"; items: unknown[] }
  // Progress tick from a judge content script -> background relays it to the originating web-app tab.
  | {
      type: "SYNC_PROGRESS";
      judge: "codeforces" | "leetcode";
      attempted: number;
      total: number;
      problemsImported: number;
      solutionsImported: number;
    }
  // Extension-backed verification: open the judge tab and report the logged-in handle.
  | { type: "VERIFY_HANDLE"; judge: "codeforces" | "leetcode" };

export interface StatusResult {
  connected: boolean;
  username?: string | null;
  displayName?: string | null;
  apiBase?: string;
}

export interface CaptureResult {
  success: boolean;
  problem_id?: string;
  was_duplicate?: boolean;
  error?: string;
}

// Messages handled by the judge content scripts (via browser.tabs.sendMessage). PARSE_PAGE is the
// popup capture path; DEEP_IMPORT is the background-driven history sync (the background opens the
// judge tab and sends this to its fetcher content script).
export type ContentMessage =
  | { type: "PARSE_PAGE" }
  | { type: "DEEP_IMPORT"; handle?: string }
  | { type: "WHOAMI" };

export interface ParsePageResult {
  payload: CapturePayload | null;
}

// The logged-in handle on the judge (for extension-backed verification).
export interface WhoamiResult {
  handle: string | null;
  signedIn: boolean;
  error?: string;
}

// Background replies for the content-script -> background helpers.
export interface ExistingIdsResult {
  ids?: string[];
  error?: string;
}
export interface ImportBatchResult {
  success?: boolean;
  problems?: { imported: number; duplicates: number; invalid: number };
  solutions?: { imported: number; duplicates: number; skipped: number; invalid: number };
  error?: string;
}

// Final summary the background returns for a SYNC_JUDGE (relayed to the web app).
export interface SyncResult {
  success: boolean;
  judge?: "codeforces" | "leetcode";
  totalFound?: number; // distinct solved problems found in the session
  alreadyHad?: number; // skipped because already imported
  attempted?: number; // problems fetched + imported this run
  problemsImported?: number;
  solutionsImported?: number;
  capped?: boolean; // hit the per-run cap; sync again to continue
  error?: string;
}

// Progress tick the background pushes to the originating web-app tab during a sync.
export interface SyncProgress {
  type: "CPJ_SYNC_PROGRESS";
  judge: "codeforces" | "leetcode";
  attempted: number;
  total: number;
  problemsImported: number;
  solutionsImported: number;
}

export interface TimerResult {
  success: boolean;
  action?: "start" | "pause" | "resume" | "stop";
  stopped?: boolean;
  problem_id?: string;
  /** Derived snapshot AFTER the action (so callers can update UI in one round-trip). */
  state?: TimerStateResult;
  error?: string;
}

// Derived timer snapshot returned by TIMER_STATE (and embedded in TimerResult.state).
export interface TimerStateResult {
  connected: boolean;
  active: boolean;
  status?: "running" | "paused";
  problemUrl?: string;
  title?: string;
  platform?: string;
  elapsedMs: number;
}

export interface CheckProblemResult {
  exists: boolean;
  problem_id?: string;
  error?: string;
}

export interface SolutionResult {
  success: boolean;
  solution_id?: string;
  problem_id?: string;
  error?: string;
}
