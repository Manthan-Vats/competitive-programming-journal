// Pure validation + shaping of solution "provenance" - where a submitted solution came from
// (judge submission time, verdict, runtime/memory, link, judge submission id). Stored on the
// solutions row (migration 008). Shared by the single-solution attach path (/api/ext/solution)
// and the deep bulk import (/api/ext/import) so both shape provenance identically.
// No DB access; everything is best-effort and degrades to null. Caps every string so an
// untrusted extension payload can't store an unbounded blob.

export interface ProvenanceInput {
  submitted_at?: unknown;
  verdict?: unknown;
  is_accepted?: unknown;
  runtime?: unknown;
  memory?: unknown;
  submission_url?: unknown;
  source_submission_id?: unknown;
}

export interface Provenance {
  submitted_at: string | null;
  verdict: string | null;
  is_accepted: boolean | null;
  runtime: string | null;
  memory: string | null;
  submission_url: string | null;
  source_submission_id: string | null;
}

function cappedStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// Only accept an http(s) URL; reject anything else (no javascript:, data:, relative, etc.).
function safeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return t.slice(0, 500);
  } catch {
    return null;
  }
}

export function buildProvenance(input: ProvenanceInput): Provenance {
  return {
    submitted_at:
      typeof input.submitted_at === "string" &&
      !Number.isNaN(Date.parse(input.submitted_at))
        ? new Date(input.submitted_at).toISOString()
        : null,
    verdict: cappedStr(input.verdict, 40),
    // Strict boolean only: a missing/garbage value stays null ("unknown"), not false.
    is_accepted: typeof input.is_accepted === "boolean" ? input.is_accepted : null,
    runtime: cappedStr(input.runtime, 40),
    memory: cappedStr(input.memory, 40),
    submission_url: safeUrl(input.submission_url),
    source_submission_id: cappedStr(input.source_submission_id, 100),
  };
}
