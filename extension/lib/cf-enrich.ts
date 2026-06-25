import { browser } from "wxt/browser";

// Codeforces rating + tags enrichment, run in the background worker.
// Why here and not in the content script: rating/tags aren't reliably in the page DOM
// (hidden during live contests), so we use the VERIFIED public API
// `problemset.problems` -> result.problems[] of {contestId, index, name, rating?, tags[]}.
// That response is large (~all problems), so we fetch it once and cache a compact
// {`${contestId}-${index}` -> {rating, tags}} map in storage with a TTL. Codeforces is in
// host_permissions, so the background fetch is allowed and CORS-free.

const CACHE_KEY = "cpj_cf_problemset";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const FETCH_TIMEOUT_MS = 8000;

interface CfEntry {
  rating?: number;
  tags?: string[];
}
interface CfCache {
  fetchedAt: number;
  map: Record<string, CfEntry>;
}

export interface CfEnrichment {
  rating?: number;
  tags?: string[];
}

// Split our platform_id ("1700C", "104000B", "1900F1") into contestId + index.
function splitPlatformId(platformId: string): { contestId: string; index: string } | null {
  const m = /^(\d+)([A-Z]\d*)$/.exec(platformId.trim().toUpperCase());
  return m ? { contestId: m[1], index: m[2] } : null;
}

// Map a Codeforces rating to our coarse difficulty bucket.
export function ratingToDifficulty(rating: number | undefined): string {
  if (!rating || rating <= 0) return "unknown";
  if (rating < 1300) return "easy";
  if (rating < 1900) return "medium";
  if (rating < 2400) return "hard";
  return "expert";
}

async function loadCache(): Promise<CfCache | null> {
  const res = await browser.storage.local.get(CACHE_KEY);
  const cache = res[CACHE_KEY] as CfCache | undefined;
  if (!cache || Date.now() - cache.fetchedAt > TTL_MS) return null;
  return cache;
}

async function refreshCache(): Promise<CfCache | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://codeforces.com/api/problemset.problems", {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.status !== "OK" || !Array.isArray(json?.result?.problems)) return null;

    const map: Record<string, CfEntry> = {};
    for (const p of json.result.problems) {
      if (p?.contestId == null || !p?.index) continue;
      map[`${p.contestId}-${String(p.index).toUpperCase()}`] = {
        rating: typeof p.rating === "number" ? p.rating : undefined,
        tags: Array.isArray(p.tags) ? p.tags : undefined,
      };
    }
    const cache: CfCache = { fetchedAt: Date.now(), map };
    await browser.storage.local.set({ [CACHE_KEY]: cache });
    return cache;
  } catch {
    // Network error / abort / parse error -> caller proceeds without enrichment.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Look up rating + tags for a Codeforces problem id. Best-effort: returns null on any
// miss (gym problems, live contests, network failure) so capture still succeeds.
export async function enrichCodeforces(platformId: string): Promise<CfEnrichment | null> {
  const ids = splitPlatformId(platformId);
  if (!ids) return null;
  const key = `${ids.contestId}-${ids.index}`;

  // Refresh ONLY when the cache is missing or stale (loadCache returns null in both cases). We
  // deliberately do NOT refresh just because one key is absent from an otherwise-fresh cache:
  // problems not in the public problemset (gym / live contest / brand-new) would otherwise force a
  // full ~10k-problem refetch on EVERY enrich call - so a bulk import of such problems would refetch
  // the entire problemset once per problem. A newly-rated problem is instead picked up on the next
  // TTL refresh (<=12h), which is fine for best-effort enrichment.
  let cache = await loadCache();
  if (!cache) cache = await refreshCache();
  const entry = cache?.map[key];
  if (!entry) return null;
  return { rating: entry.rating, tags: entry.tags };
}
