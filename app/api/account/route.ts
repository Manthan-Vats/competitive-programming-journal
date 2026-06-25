import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// Self-service account: export-my-data (GET) and delete-my-account (DELETE). Both are scoped to the
// authenticated caller only. Deletion removes the Supabase auth user, which CASCADES every per-user
// table (problems/solutions/ai_analyses/timing_sessions/profile/review_cards/platform_verifications/
// extension_tokens/user_ai_keys/ai_assists/access_requests all FK auth.users ON DELETE CASCADE).
// Required for the Chrome Web Store data policy and basic data-rights hygiene.

export const runtime = "nodejs";

// GET /api/account -> a JSON snapshot of everything we hold for this user, as a file download.
// Uses the RLS-scoped client so it can only ever return the caller's own rows.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await rateLimit(`account-export:${user.id}`, 10, 3600))) {
    return NextResponse.json({ error: "Too many export requests. Try again later." }, { status: 429 });
  }

  try {
    const [profile, problems, verifications, reviewCards] = await Promise.all([
      supabase.from("profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("problems")
        .select("*, solutions (*, ai_analyses (*)), timing_sessions (*)")
        .eq("user_id", user.id),
      supabase.from("platform_verifications").select("*").eq("user_id", user.id),
      supabase.from("review_cards").select("*").eq("user_id", user.id),
    ]);

    const dump = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email, created_at: user.created_at },
      profile: profile.data ?? null,
      problems: problems.data ?? [],
      platform_verifications: verifications.data ?? [],
      review_cards: reviewCards.data ?? [],
      note: "Your encrypted Gemini API key is never exported. Delete it from Settings if you wish.",
    };

    return new NextResponse(JSON.stringify(dump, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="cp-journal-export-${user.id.slice(0, 8)}.json"`,
      },
    });
  } catch (err) {
    return errorResponse("account.export", err, "Could not export your data");
  }
}

// DELETE /api/account -> permanently delete the caller's account and ALL their data. Requires the
// body { confirm: "DELETE" } so it can't fire by accident. Irreversible.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await rateLimit(`account-delete:${user.id}`, 5, 3600))) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
  }

  try {
    // Service-role delete of the auth user; FK cascades wipe every per-user table.
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return errorResponse("account.delete", error, "Could not delete your account");

    // Best-effort: clear the now-invalid session cookies so the browser is logged out.
    await supabase.auth.signOut().catch(() => {});

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return errorResponse("account.delete", err, "Could not delete your account");
  }
}
