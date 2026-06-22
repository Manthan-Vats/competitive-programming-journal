import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveExtensionUser } from "@/lib/auth/ext-token";
import { shapeImportItems, type ImportItem } from "@/lib/ext/import-batch";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// Deep bulk import from the extension (Wave 3). The extension gathers the user's solved
// problems from their LOGGED-IN judge session - including the submitted source + provenance
// it can read (CF submitSource, LC submissionDetails) - and POSTs them here as a batch.
// Bearer-authed (service-role insert, user_id stamped from the resolved token). We dedupe
// problems by (user_id, url) and solutions by (user_id, source_submission_id), and bulk-insert
// so a large account is a few round-trips, not one per row.

export const runtime = "nodejs";

const MAX_ITEMS = 5000;
const INSERT_CHUNK = 500;

// The extension calls this BEFORE a deep import to learn which submissions it already has, so it
// only fetches source for genuinely-new submissions (CF submitSource is one slow request each) -
// making re-runs cheap and the import resumable. Bearer-authed; returns this user's rows only.
export async function GET(request: NextRequest) {
  const identity = await resolveExtensionUser(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("solutions")
      .select("source_submission_id")
      .eq("user_id", identity.userId)
      .not("source_submission_id", "is", null);
    if (error) return errorResponse("ext.import.GET", error, "Failed to read import state");

    const ids = (data ?? [])
      .map((r) => r.source_submission_id as string | null)
      .filter((v): v is string => !!v);
    return NextResponse.json({ source_submission_ids: ids });
  } catch (err) {
    return errorResponse("ext.import.GET", err, "Failed to read import state");
  }
}

export async function POST(request: NextRequest) {
  const identity = await resolveExtensionUser(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = identity.userId;

  // Per-user throttle: a deep import is heavy (judge session reads + bulk writes).
  if (!(await rateLimit(`ext-import:${userId}`, 10, 3600))) {
    return NextResponse.json(
      { error: "Import was run too recently. Please wait a bit and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawItems: unknown = (body as { items?: unknown }).items;
    if (!Array.isArray(rawItems)) {
      return NextResponse.json({ error: "Body must include an items array" }, { status: 400 });
    }
    if (rawItems.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Too many items (max ${MAX_ITEMS} per import)` },
        { status: 400 }
      );
    }

    const shaped = shapeImportItems(userId, rawItems as ImportItem[]);
    const admin = createAdminClient();

    //  Problems: resolve existing by url (noting which lack a statement), bulk-insert new
    const { data: existingProblems, error: exErr } = await admin
      .from("problems")
      .select("id, url, statement")
      .eq("user_id", userId);
    if (exErr) return errorResponse("ext.import.existingProblems", exErr, "Import failed reading existing problems");

    const idByUrl = new Map<string, string>();
    const needsStatement = new Set<string>(); // urls of PRE-EXISTING problems with no statement yet
    for (const r of existingProblems ?? []) {
      idByUrl.set(r.url as string, r.id as string);
      const st = r.statement as string | null;
      if (!st || !st.trim()) needsStatement.add(r.url as string);
    }

    const newProblemRows = shaped.problemRows.filter((r) => !idByUrl.has(r.url));
    let problemsImported = 0;
    for (let i = 0; i < newProblemRows.length; i += INSERT_CHUNK) {
      const chunk = newProblemRows.slice(i, i + INSERT_CHUNK);
      const { data: inserted, error } = await admin
        .from("problems")
        .insert(chunk)
        .select("id, url");
      if (error) return errorResponse("ext.import.insertProblems", error, "Import failed saving problems");
      for (const r of inserted ?? []) idByUrl.set(r.url as string, r.id as string);
      problemsImported += inserted?.length ?? 0;
    }
    const problemsDuplicate = shaped.problemRows.length - newProblemRows.length;

    // Backfill statements onto PRE-EXISTING problems that had none - e.g. Codeforces problems
    // synced before statement-scraping existed. Only when the incoming item now carries one; we
    // never overwrite an existing statement. Bounded concurrency keeps it gentle.
    const backfill = shaped.problemRows.filter(
      (r) => needsStatement.has(r.url) && typeof r.statement === "string" && !!r.statement.trim()
    );
    let problemsEnriched = 0;
    const BACKFILL_CONCURRENCY = 20;
    for (let i = 0; i < backfill.length; i += BACKFILL_CONCURRENCY) {
      const group = backfill.slice(i, i + BACKFILL_CONCURRENCY);
      await Promise.all(
        group.map(async (r) => {
          const id = idByUrl.get(r.url);
          if (!id) return;
          const { error } = await admin
            .from("problems")
            .update({ statement: r.statement })
            .eq("id", id)
            .eq("user_id", userId);
          if (!error) problemsEnriched++;
        })
      );
    }

    //  Solutions: dedupe by (user_id, source_submission_id), attach to resolved problem
    const { data: existingSubs, error: subErr } = await admin
      .from("solutions")
      .select("source_submission_id")
      .eq("user_id", userId)
      .not("source_submission_id", "is", null);
    if (subErr) return errorResponse("ext.import.existingSubs", subErr, "Import failed reading existing solutions");

    const seenSubmissionIds = new Set<string>();
    for (const r of existingSubs ?? []) {
      if (r.source_submission_id) seenSubmissionIds.add(r.source_submission_id as string);
    }

    let solutionsDuplicate = 0;
    let solutionsSkipped = 0;
    const solutionRows = [];
    for (const draft of shaped.solutionDrafts) {
      const problemId = idByUrl.get(draft.url);
      if (!problemId) {
        solutionsSkipped++; // problem failed to insert - can't attach
        continue;
      }
      const subId = draft.provenance.source_submission_id;
      if (subId) {
        if (seenSubmissionIds.has(subId)) {
          solutionsDuplicate++;
          continue;
        }
        seenSubmissionIds.add(subId); // guard against intra-batch dupes
      }
      solutionRows.push({
        user_id: userId,
        problem_id: problemId,
        language: draft.language,
        code: draft.code,
        label: draft.label,
        is_public_code: draft.is_public_code,
        ai_status: "none", // user triggers AI from the web app
        ...draft.provenance,
      });
    }

    let solutionsImported = 0;
    for (let i = 0; i < solutionRows.length; i += INSERT_CHUNK) {
      const chunk = solutionRows.slice(i, i + INSERT_CHUNK);
      const { data: inserted, error } = await admin.from("solutions").insert(chunk).select("id");
      if (error) return errorResponse("ext.import.insertSolutions", error, "Import failed saving solutions");
      solutionsImported += inserted?.length ?? 0;
    }

    return NextResponse.json({
      success: true,
      problems: {
        imported: problemsImported,
        duplicates: problemsDuplicate,
        enriched: problemsEnriched, // pre-existing problems backfilled with a statement
        invalid: shaped.invalidProblems,
      },
      solutions: {
        imported: solutionsImported,
        duplicates: solutionsDuplicate,
        skipped: solutionsSkipped,
        invalid: shaped.invalidSolutions,
      },
    });
  } catch (err) {
    return errorResponse("ext.import.POST", err, "Failed to import");
  }
}
