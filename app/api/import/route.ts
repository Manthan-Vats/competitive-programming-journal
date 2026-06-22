import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  buildProblemRow,
  type CaptureInput,
  type ProblemRow,
} from "@/lib/ext/capture-problem";
import { fetchCodeforcesSolved, fetchLeetcodeSolved } from "@/lib/import/judges";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// Bulk-import the signed-in user's solved problems from their configured judge handles
// (web-app action: uses stored cf_handle / lc_handle, no judge login required).
// Codeforces = full solved history with rating+tags (one user.status call).
// LeetCode    = the 20 most-recent ACs (anonymous recentAcSubmissionList cap).
// We reuse buildProblemRow (the same validation/shaping as one-click capture) but fetch
// the user's existing URLs once and bulk-insert only the new rows, so importing a large
// account is a couple of round-trips rather than one per problem.

export const runtime = "nodejs";

interface PlatformSummary {
  found: number;
  imported: number;
  duplicates: number;
  error?: string;
}

const INSERT_CHUNK = 500;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per-user throttle: each import hammers the judge APIs (CF limits to 1 req/2s) and bulk-
  // inserts, so cap how often a user can kick one off.
  if (!(await rateLimit(`import:${user.id}`, 5, 3600))) {
    return NextResponse.json(
      { error: "Import was run too recently. Please wait a bit and try again." },
      { status: 429 }
    );
  }

  // Read the caller's own handles (RLS own_rows scopes this to their row).
  const { data: profile } = await supabase
    .from("profile")
    .select("cf_handle, lc_handle")
    .eq("user_id", user.id)
    .maybeSingle();

  const cfHandle = profile?.cf_handle?.trim() || "";
  const lcHandle = profile?.lc_handle?.trim() || "";
  if (!cfHandle && !lcHandle) {
    return NextResponse.json(
      { error: "Set a Codeforces or LeetCode handle in Settings first." },
      { status: 400 }
    );
  }

  // Fetch both judges in parallel.
  const [cf, lc] = await Promise.all([
    cfHandle ? fetchCodeforcesSolved(cfHandle) : Promise.resolve({ items: [] as CaptureInput[] }),
    lcHandle ? fetchLeetcodeSolved(lcHandle) : Promise.resolve({ items: [] as CaptureInput[] }),
  ]);

  const admin = createAdminClient();

  // One query for all of the user's existing problem URLs -> fast dedupe.
  const { data: existingRows, error: existingErr } = await admin
    .from("problems")
    .select("url")
    .eq("user_id", user.id);
  if (existingErr) {
    return errorResponse("import.existing", existingErr, "Failed to read existing problems");
  }
  const existingUrls = new Set((existingRows ?? []).map((r) => r.url as string));

  const rowsToInsert: ProblemRow[] = [];

  // Build the new rows for one platform's fetch result, tracking dedupe + invalids.
  function collect(fetchResult: { items: CaptureInput[] } | { error: string }): PlatformSummary {
    if ("error" in fetchResult) {
      return { found: 0, imported: 0, duplicates: 0, error: fetchResult.error };
    }
    const items = fetchResult.items;
    let imported = 0;
    let duplicates = 0;
    for (const item of items) {
      const url = typeof item.url === "string" ? item.url : "";
      if (!url || existingUrls.has(url)) {
        duplicates++;
        continue;
      }
      const built = buildProblemRow(user!.id, item);
      if ("error" in built) {
        // Malformed item (missing url/title) - count as skipped duplicate-ish, don't abort.
        duplicates++;
        continue;
      }
      existingUrls.add(url); // guard against intra-run dupes
      rowsToInsert.push(built.row);
      imported++;
    }
    return { found: items.length, imported, duplicates };
  }

  const codeforces = cfHandle
    ? collect(cf)
    : { found: 0, imported: 0, duplicates: 0 };
  const leetcode = lcHandle
    ? collect(lc)
    : { found: 0, imported: 0, duplicates: 0 };

  // Bulk insert the new rows in chunks. If a chunk fails, surface it but keep what we have.
  let insertError: string | undefined;
  for (let i = 0; i < rowsToInsert.length; i += INSERT_CHUNK) {
    const chunk = rowsToInsert.slice(i, i + INSERT_CHUNK);
    const { error } = await admin.from("problems").insert(chunk);
    if (error) {
      insertError = error.message;
      break;
    }
  }
  if (insertError) {
    return errorResponse("import.insert", insertError, "Import failed while saving problems");
  }

  return NextResponse.json({
    success: true,
    imported: codeforces.imported + leetcode.imported,
    codeforces,
    leetcode,
  });
}
