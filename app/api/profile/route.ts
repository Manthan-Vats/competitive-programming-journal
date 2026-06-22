import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-error";

// Trim, null-out empties, and cap length so a profile field can't store an unbounded blob.
function capped(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t.slice(0, max) : null;
}

// Reserved handles that must not be claimable as a public username (they collide
// with routes or would be confusing on /u/<handle>).
const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "login",
  "logout",
  "auth",
  "u",
  "settings",
  "problem",
  "problems",
  "about",
  "null",
  "undefined",
  "me",
]);

/** Normalise + validate a public handle. Returns the cleaned value or an error. */
function normalizeUsername(raw: unknown): { value: string | null; error?: string } {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== "string") return { value: null, error: "Invalid username" };
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "") return { value: null };
  if (!/^[a-z0-9_-]{3,30}$/.test(trimmed)) {
    return {
      value: null,
      error:
        "Username must be 3-30 chars: lowercase letters, numbers, hyphen or underscore.",
    };
  }
  if (RESERVED_USERNAMES.has(trimmed)) {
    return { value: null, error: "That username is reserved." };
  }
  return { value: trimmed };
}

// Returns the authenticated caller's own profile row (or null if none yet).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: profile, error } = await supabase
      .from("profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(profile);
  } catch (err) {
    return errorResponse("profile.GET", err, "Failed to fetch profile");
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      username,
      display_name,
      bio,
      cf_handle,
      lc_handle,
      ac_handle,
      github_handle,
    } = body;

    const { value: cleanUsername, error: usernameError } =
      normalizeUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    // Normalise empty strings to null + cap length so the DB stays clean and bounded.
    const fields = {
      username: cleanUsername,
      display_name: capped(display_name, 80),
      bio: capped(bio, 500),
      cf_handle: capped(cf_handle, 60),
      lc_handle: capped(lc_handle, 60),
      ac_handle: capped(ac_handle, 60),
      github_handle: capped(github_handle, 60),
    };

    // Exactly one profile row per user (unique on user_id): update if present,
    // else insert. RLS own_rows ensures we only touch our own row.
    const { data: existing } = await supabase
      .from("profile")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("profile")
        .update(fields)
        .eq("user_id", user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("profile")
        .insert({ ...fields, user_id: user.id })
        .select()
        .single();
    }

    if (result.error) {
      // 23505 = unique violation (username already taken).
      if ((result.error as any).code === "23505") {
        return NextResponse.json(
          { error: "That username is already taken." },
          { status: 409 }
        );
      }
      throw result.error;
    }

    return NextResponse.json(result.data);
  } catch (err) {
    return errorResponse("profile.PUT", err, "Failed to update profile");
  }
}
