import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";
import {
  isVerifyPlatform,
  generateVerifyToken,
  placementHint,
  fetchProfileForVerify,
  tokenIn,
} from "@/lib/verify";

// Handle verification (P3). GET lists the user's verifications; POST {action:"start"} issues a
// one-time token to paste into the platform's public profile; POST {action:"confirm"} fetches the
// public profile, checks the token, and on success records a stats snapshot (pulled, not typed).
// Authenticated owner only; RLS (own_rows) scopes every row to the caller.

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from("platform_verifications")
      .select("platform, handle, status, tier, verified_at, last_synced_at, source, stats")
      .eq("user_id", user.id);
    if (error) return errorResponse("verify.GET", error, "Failed to load verifications");
    return NextResponse.json({ verifications: data ?? [] });
  } catch (err) {
    return errorResponse("verify.GET", err, "Failed to load verifications");
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const platform = body.platform;
    if (!isVerifyPlatform(platform)) {
      return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
    }

    //  start: issue a token, mark pending
    if (action === "start") {
      const handle = typeof body.handle === "string" ? body.handle.trim() : "";
      if (!handle) return NextResponse.json({ error: "Handle is required" }, { status: 400 });
      if (handle.length > 100) return NextResponse.json({ error: "Handle too long" }, { status: 400 });

      const token = generateVerifyToken();
      const { error } = await supabase.from("platform_verifications").upsert(
        {
          user_id: user.id,
          platform,
          handle,
          status: "pending",
          tier: "token",
          token,
          verified_at: null,
        },
        { onConflict: "user_id,platform" }
      );
      if (error) return errorResponse("verify.start", error, "Failed to start verification");
      return NextResponse.json({ token, hint: placementHint(platform) });
    }

    //  confirm: fetch the public profile, check the token, snapshot stats
    if (action === "confirm") {
      // Confirm hits an external API - throttle per user.
      if (!(await rateLimit(`verify:${user.id}`, 20, 3600))) {
        return NextResponse.json(
          { error: "Too many verification attempts. Please wait a bit." },
          { status: 429 }
        );
      }

      const { data: row, error: rErr } = await supabase
        .from("platform_verifications")
        .select("handle, token")
        .eq("user_id", user.id)
        .eq("platform", platform)
        .maybeSingle();
      if (rErr) return errorResponse("verify.confirm.load", rErr, "Failed to verify");
      if (!row?.token) {
        return NextResponse.json(
          { error: "Start verification first to get a token." },
          { status: 400 }
        );
      }

      const probe = await fetchProfileForVerify(platform, row.handle as string);
      if ("error" in probe) {
        return NextResponse.json({ verified: false, error: probe.error }, { status: 200 });
      }
      if (!tokenIn(probe.fields, row.token as string)) {
        return NextResponse.json(
          {
            verified: false,
            error: "Token not found in your public profile yet - add it, save, then Check again.",
          },
          { status: 200 }
        );
      }

      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("platform_verifications")
        .update({
          status: "verified",
          token: null, // one-time: clear so it's never publicly readable
          verified_at: now,
          last_synced_at: now,
          source: probe.source,
          stats: probe.stats,
        })
        .eq("user_id", user.id)
        .eq("platform", platform);
      if (upErr) return errorResponse("verify.confirm.save", upErr, "Failed to verify");

      return NextResponse.json({ verified: true, stats: probe.stats });
    }

    //  confirm_extension: the companion read the handle you're LOGGED IN as
    // (a frictionless, no-token tier). `evidence` is that logged-in handle, read from your
    // authenticated judge session by the extension; we verify it exists + snapshot its stats.
    if (action === "confirm_extension") {
      if (!(await rateLimit(`verify:${user.id}`, 20, 3600))) {
        return NextResponse.json(
          { error: "Too many verification attempts. Please wait a bit." },
          { status: 429 }
        );
      }
      const evidence = typeof body.evidence === "string" ? body.evidence.trim() : "";
      if (!evidence) {
        return NextResponse.json(
          { verified: false, error: "The companion couldn't read a logged-in handle - log in to the judge and retry." },
          { status: 200 }
        );
      }
      if (evidence.length > 100) {
        return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
      }

      const probe = await fetchProfileForVerify(platform, evidence);
      if ("error" in probe) {
        return NextResponse.json({ verified: false, error: probe.error }, { status: 200 });
      }

      const now = new Date().toISOString();
      const { error: upErr } = await supabase.from("platform_verifications").upsert(
        {
          user_id: user.id,
          platform,
          handle: evidence,
          status: "verified",
          tier: "extension",
          token: null,
          verified_at: now,
          last_synced_at: now,
          source: `${probe.source} (companion login)`,
          stats: probe.stats,
        },
        { onConflict: "user_id,platform" }
      );
      if (upErr) return errorResponse("verify.confirm_extension", upErr, "Failed to verify");

      return NextResponse.json({ verified: true, handle: evidence, stats: probe.stats });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return errorResponse("verify.POST", err, "Failed to verify");
  }
}
