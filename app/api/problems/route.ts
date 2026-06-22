import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlatform, isDifficultyNorm } from "@/lib/difficulty";
import { errorResponse } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const difficulty = searchParams.get("difficulty");
  const tag = searchParams.get("tag");
  const search = searchParams.get("search");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authenticated tenants see their OWN journal (public + private); anonymous
  // visitors see only published problems. RLS enforces the same boundary; the
  // explicit filters keep an authenticated user's journal from mixing in other
  // users' public rows.
  const isOwnerView = !!user;

  try {
    // 1. Fetch problems with solutions, sessions, and analyses
    let query = supabase.from("problems").select(`
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
    `);

    // Scope to the viewer's own rows when authenticated, else to published rows.
    if (isOwnerView) {
      query = query.eq("user_id", user!.id);
    } else {
      query = query.eq("is_public", true);
    }

    // Apply filters at DB level where easy, otherwise filter in memory
    if (platform && platform !== "all") {
      query = query.eq("platform", platform);
    }
    if (difficulty && difficulty !== "all") {
      query = query.eq("difficulty_norm", difficulty);
    }

    const { data: problemsData, error } = await query;
    if (error) throw error;

    // 2. Map computed properties and filter in memory for complex criteria
    let formattedProblems = (problemsData || []).map((p: any) => {
      // Show all solutions on the owner's own journal; only public ones otherwise.
      const filteredSolutions = isOwnerView
        ? p.solutions
        : p.solutions.filter((s: any) => s.is_public_code);

      // Compute total seconds from ended timing sessions
      const total_seconds = p.timing_sessions.reduce((acc: number, s: any) => {
        if (s.started_at && s.ended_at) {
          const diff = Math.floor(
            (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000
          );
          return acc + (diff > 0 ? diff : 0);
        }
        return acc;
      }, 0);

      // Compute AI tags union from all solutions
      const aiTagsSet = new Set<string>();
      filteredSolutions.forEach((sol: any) => {
        sol.ai_analyses?.forEach((analysis: any) => {
          analysis.algorithms?.forEach((t: string) => aiTagsSet.add(t));
          analysis.data_structures?.forEach((t: string) => aiTagsSet.add(t));
          analysis.techniques?.forEach((t: string) => aiTagsSet.add(t));
          analysis.math_concepts?.forEach((t: string) => aiTagsSet.add(t));
        });
      });
      const ai_tags = Array.from(aiTagsSet);

      return {
        ...p,
        solutions: filteredSolutions,
        total_seconds,
        ai_tags,
      };
    });

    // In-memory filters for tags and search
    if (tag) {
      const lowerTag = tag.toLowerCase();
      formattedProblems = formattedProblems.filter(
        (p) =>
          p.source_tags?.some((t: string) => t.toLowerCase() === lowerTag) ||
          p.custom_tags?.some((t: string) => t.toLowerCase() === lowerTag) ||
          p.ai_tags?.some((t: string) => t.toLowerCase() === lowerTag)
      );
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      formattedProblems = formattedProblems.filter(
        (p) =>
          p.title.toLowerCase().includes(lowerSearch) ||
          p.platform_id?.toLowerCase().includes(lowerSearch) ||
          p.source_tags?.some((t: string) => t.toLowerCase().includes(lowerSearch)) ||
          p.custom_tags?.some((t: string) => t.toLowerCase().includes(lowerSearch)) ||
          p.ai_tags?.some((t: string) => t.toLowerCase().includes(lowerSearch))
      );
    }

    // Sort by solve date DESC (falling back to insert time when undated).
    formattedProblems.sort(
      (a, b) =>
        new Date(b.solved_at || b.created_at).getTime() -
        new Date(a.solved_at || a.created_at).getTime()
    );

    return NextResponse.json(formattedProblems);
  } catch (err) {
    return errorResponse("problems.GET", err, "Failed to fetch problems");
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Any invited (authenticated) user may create problems in their OWN journal.
  // Per-row ownership is enforced by RLS via the stamped user_id below.
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      url,
      title,
      platform,
      platform_id,
      difficulty_raw,
      difficulty_norm,
      source_tags,
      custom_tags,
      notes,
      is_public,
      is_featured,
      solved_at,
    } = body;

    if (!url || !title || !platform) {
      return NextResponse.json(
        { error: "Missing required fields (url, title, platform)" },
        { status: 400 }
      );
    }

    // Allowlist platform + difficulty against the shared enums and clamp tag arrays (P2-1),
    // so the manual create path matches the capture/import path's shaping instead of trusting
    // raw client values. Unknown platform/difficulty fall back rather than reject (the form
    // can post "other"/free text on a metadata miss).
    const safePlatform = isPlatform(platform) ? platform : "other";
    const safeDifficultyNorm = isDifficultyNorm(difficulty_norm) ? difficulty_norm : "unknown";
    const safeSourceTags = Array.isArray(source_tags)
      ? source_tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 40)
      : [];
    const safeCustomTags = Array.isArray(custom_tags)
      ? custom_tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 40)
      : [];

    // Check URL uniqueness within THIS user's journal (URLs are unique per user).
    const { data: existing } = await supabase
      .from("problems")
      .select("id")
      .eq("url", url)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A problem with this URL already exists", existing_id: existing.id },
        { status: 409 }
      );
    }

    const { data: created, error } = await supabase
      .from("problems")
      .insert({
        user_id: user.id,
        url,
        title,
        platform: safePlatform,
        platform_id: platform_id || null,
        difficulty_raw: difficulty_raw || null,
        difficulty_norm: safeDifficultyNorm,
        source_tags: safeSourceTags,
        custom_tags: safeCustomTags,
        notes: typeof notes === "string" ? notes.slice(0, 5000) : null,
        // Optional user-supplied solve date; store normalized ISO, else null (DB created_at
        // still records when the row was inserted).
        solved_at:
          typeof solved_at === "string" && !Number.isNaN(Date.parse(solved_at))
            ? new Date(solved_at).toISOString()
            : null,
        // Private by default (audit B2): publish is an explicit per-row toggle. Coerce to a
        // real boolean so a truthy non-bool body value can't be stored verbatim (matches PATCH).
        is_public: !!is_public,
        is_featured: !!is_featured,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return errorResponse("problems.POST", err, "Failed to create problem");
  }
}
