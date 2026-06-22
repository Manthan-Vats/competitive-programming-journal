import {
  buildProblemRow,
  type CaptureInput,
  type ProblemRow,
} from "@/lib/ext/problem-row";
import {
  buildProvenance,
  type ProvenanceInput,
  type Provenance,
} from "@/lib/ext/solution-provenance";
import { SOLUTION_LANGUAGES, MAX_CODE_LENGTH } from "@/lib/difficulty";

// Pure shaping for the deep-import batch (/api/ext/import). The extension gathers solved
// problems (and, where it can read them from the logged-in session, the submitted source +
// provenance) and POSTs them here. This turns that untrusted batch into validated, deduped,
// insertable rows WITHOUT touching the DB, so it's unit-testable. The route does the DB
// resolution (existing-url -> id, existing-submission-id dedupe, bulk insert).

export interface ImportSolutionInput extends ProvenanceInput {
  language?: unknown;
  code?: unknown;
  label?: unknown;
  is_public_code?: unknown;
}

export interface ImportItem {
  problem?: CaptureInput;
  solution?: ImportSolutionInput;
}

// A solution that still references its problem by canonical url (the route maps url -> the
// resolved problem_id after problems are upserted).
export interface SolutionDraft {
  url: string;
  language: string;
  code: string;
  label: string | null;
  is_public_code: boolean;
  provenance: Provenance;
}

export interface ShapedImport {
  problemRows: ProblemRow[]; // deduped by url within the batch
  solutionDrafts: SolutionDraft[];
  invalidProblems: number;
  invalidSolutions: number;
}

export function shapeImportItems(userId: string, items: ImportItem[]): ShapedImport {
  const problemByUrl = new Map<string, ProblemRow>();
  const solutionDrafts: SolutionDraft[] = [];
  let invalidProblems = 0;
  let invalidSolutions = 0;

  for (const item of Array.isArray(items) ? items : []) {
    const built = buildProblemRow(userId, item?.problem ?? {});
    if ("error" in built) {
      invalidProblems++;
      continue; // a problem we can't even shape (no url/title) - skip its solution too
    }
    const row = built.row;
    if (!problemByUrl.has(row.url)) problemByUrl.set(row.url, row);

    const sol = item?.solution;
    if (sol) {
      const language =
        typeof sol.language === "string" && SOLUTION_LANGUAGES.has(sol.language)
          ? sol.language
          : null;
      const code = typeof sol.code === "string" ? sol.code : "";
      if (!language || !code.trim() || code.length > MAX_CODE_LENGTH) {
        invalidSolutions++;
      } else {
        solutionDrafts.push({
          url: row.url,
          language,
          code,
          label: typeof sol.label === "string" ? sol.label.slice(0, 120) : null,
          // Strict boolean: imported code stays PRIVATE unless the payload explicitly says
          // true (publishing is a deliberate per-row action, never a side effect of import).
          is_public_code: sol.is_public_code === true,
          provenance: buildProvenance(sol),
        });
      }
    }
  }

  return {
    problemRows: Array.from(problemByUrl.values()),
    solutionDrafts,
    invalidProblems,
    invalidSolutions,
  };
}
