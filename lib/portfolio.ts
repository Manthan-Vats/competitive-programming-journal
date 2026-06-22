import { tagsToPatterns } from "@/lib/patterns";

// Aggregate the canonical patterns the public problems cover, by problem count (desc). Powers the
// "Patterns" (depth) section on the public verify pages (P3).
export function computePatternCounts(
  problems: { source_tags?: string[] | null; custom_tags?: string[] | null }[]
): { pattern: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of problems ?? []) {
    const pats = tagsToPatterns([...(p.source_tags ?? []), ...(p.custom_tags ?? [])]);
    for (const pat of pats) counts.set(pat, (counts.get(pat) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
}

// Shared shaping for public portfolio pages (the operator's `/` and each user's
// `/u/<handle>`). Takes raw problems (with nested public solutions, ai_analyses
// and timing_sessions) and computes total_seconds + the union of AI tags, keeping
// only publicly-shared solutions. Sorted newest-first.

export function processPublicProblems(problems: any[] | null | undefined) {
  const processed = (problems || []).map((p: any) => {
    const publicSolutions = (p.solutions || []).filter(
      (s: any) => s.is_public_code
    );

    const total_seconds = (p.timing_sessions || []).reduce(
      (acc: number, s: any) => {
        if (s.started_at && s.ended_at) {
          const diff = Math.floor(
            (new Date(s.ended_at).getTime() -
              new Date(s.started_at).getTime()) /
              1000
          );
          return acc + (diff > 0 ? diff : 0);
        }
        return acc;
      },
      0
    );

    const aiTagsSet = new Set<string>();
    publicSolutions.forEach((sol: any) => {
      sol.ai_analyses?.forEach((analysis: any) => {
        analysis.algorithms?.forEach((t: string) => aiTagsSet.add(t));
        analysis.data_structures?.forEach((t: string) => aiTagsSet.add(t));
        analysis.techniques?.forEach((t: string) => aiTagsSet.add(t));
        analysis.math_concepts?.forEach((t: string) => aiTagsSet.add(t));
      });
    });

    return {
      ...p,
      solutions: publicSolutions,
      total_seconds,
      ai_tags: Array.from(aiTagsSet),
    };
  });

  processed.sort(
    (a, b) =>
      new Date(b.solved_at || b.created_at).getTime() -
      new Date(a.solved_at || a.created_at).getTime()
  );

  return processed;
}

// The columns selected for a public portfolio query (problems + nested public-safe
// relations). Reused by `/` and `/u/<handle>`.
export const PUBLIC_PORTFOLIO_SELECT = `
  *,
  solutions (
    id,
    language,
    is_public_code,
    ai_status,
    ai_analyses (
      algorithms,
      data_structures,
      techniques,
      math_concepts
    )
  ),
  timing_sessions (
    started_at,
    ended_at
  )
`;

// The profile columns safe to read on PUBLIC pages. The `profile` table's public-read RLS is
// `USING (true)`, so we select explicitly (never `*`) - if a private column is ever added to the
// table it must NOT silently leak onto the public portfolio / verify pages.
export const PUBLIC_PROFILE_SELECT =
  "id, user_id, username, display_name, bio, cf_handle, lc_handle, ac_handle, github_handle, updated_at";
