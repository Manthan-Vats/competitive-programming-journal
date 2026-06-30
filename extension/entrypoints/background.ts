import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import type {
  ExtMessage,
  StatusResult,
  CaptureResult,
  TimerResult,
  TimerStateResult,
  CheckProblemResult,
  SolutionResult,
  SyncResult,
} from "../lib/messages";
import {
  getSession,
  setSession,
  clearSession,
  getActiveTimer,
  setActiveTimer,
  clearActiveTimer,
  elapsedMs,
  snapshot,
  type ExtSession,
  type ActiveTimer,
} from "../lib/session";
import { enrichCodeforces, ratingToDifficulty } from "../lib/cf-enrich";
import type { CapturePayload } from "../lib/messages";
import { syncJudge, whoamiJudge } from "../lib/sync";

// The background worker owns the session and is the only context that talks to the
// cp-journal API (Authorization: Bearer <per-user token>). Content scripts and the
// popup message it. MV3 workers are ephemeral, so the session lives in
// chrome.storage.local (not in-memory).

// The cp-journal web-app origins the per-user bearer token may ever be sent to. Keep this in
// sync with entrypoints/connect.content.ts `matches` and wxt.config host_permissions. The token's
// destination is NEVER taken from message data - only from a validated sender origin in this set -
// so a tampered message can't redirect the token to an attacker.
const TRUSTED_APP_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "https://solvelog.vercel.app",
  "https://competitive-programming-journal.vercel.app",
]);

type MsgSender = { id?: string; origin?: string; url?: string; tab?: { id?: number } };

function senderOrigin(sender: MsgSender): string | null {
  try {
    if (sender.origin) return sender.origin;
    if (sender.url) return new URL(sender.url).origin;
  } catch {
    /* ignore */
  }
  return null;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: ExtMessage, sender, sendResponse) => {
      handle(message, sender as MsgSender)
        .then(sendResponse)
        .catch((err) =>
          sendResponse({ error: err?.message ?? String(err) })
        );
      return true; // keep the channel open for the async response
    }
  );
});

async function handle(
  message: ExtMessage,
  sender: MsgSender
): Promise<unknown> {
  // Defense-in-depth: only accept messages from our own extension's contexts. (We set no
  // externally_connectable, so web pages can't reach us directly; this guards against that ever
  // changing and against any cross-extension messaging.)
  if (sender.id && browser.runtime.id && sender.id !== browser.runtime.id) {
    return { error: "Untrusted sender" };
  }

  switch (message.type) {
    case "SET_TOKEN": {
      // The token may only be bound to a trusted app origin, taken from the VALIDATED sender
      // (the connect content script's page), not from the message payload.
      const origin = senderOrigin(sender);
      if (!origin || !TRUSTED_APP_ORIGINS.has(origin)) {
        return { error: "Untrusted origin" };
      }
      await setSession({ token: message.token, apiBase: origin });
      return { ok: true };
    }

    case "DISCONNECT":
      await clearSession();
      return { ok: true };

    case "GET_STATUS":
      return getStatus();

    case "CAPTURE":
      return capture(message.payload);

    case "TIMER":
      return timer(message.action, message.payload);

    case "TIMER_STATE":
      return timerState();

    case "CHECK_PROBLEM":
      return checkProblem(message.url);

    case "ATTACH_SOLUTION":
      return attachSolution(message.payload, message.language, message.code, message.label);

    case "SYNC_JUDGE":
      return runSync(message.judge, message.handle, sender.tab?.id);

    case "VERIFY_HANDLE":
      return whoamiJudge(message.judge);

    // From a judge fetcher content script (during a sync):
    case "IMPORT_EXISTING_IDS":
      return importExistingIds();
    case "IMPORT_BATCH":
      return importBatch(message.items);
    case "SYNC_PROGRESS":
      relayProgress(message);
      return { ok: true };

    default:
      return { error: "Unknown message" };
  }
}

// History sync (Wave 3 Part C). The web app triggers this; the background OPENS (or reuses) a judge
// tab and tells its content script to fetch - content scripts run on the judge origin, so their
// credentialed fetches carry the session cookies (a background SW fetch does NOT reliably do so).
// The user never opens the judge themselves. Progress ticks from the content script are relayed to
// the originating web-app tab.
let activeWebAppTab: number | undefined;

async function runSync(
  judge: "codeforces" | "leetcode",
  handle: string | undefined,
  webAppTabId: number | undefined
): Promise<SyncResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, judge, error: "Not connected - click Connect in the companion first." };
  }
  activeWebAppTab = webAppTabId;
  try {
    return await syncJudge(judge, handle);
  } finally {
    activeWebAppTab = undefined;
  }
}

function relayProgress(message: {
  judge: "codeforces" | "leetcode";
  attempted: number;
  total: number;
  problemsImported: number;
  solutionsImported: number;
}): void {
  if (activeWebAppTab == null) return;
  browser.tabs
    .sendMessage(activeWebAppTab, { type: "CPJ_SYNC_PROGRESS", ...message })
    .catch(() => {
      /* web-app tab navigated away - progress is best-effort */
    });
}

// The judge fetcher content scripts route their API I/O through here so the bearer token never
// leaves the background.
async function importExistingIds(): Promise<{ ids?: string[]; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not connected" };
  try {
    const res = await fetch(`${session.apiBase}/api/ext/import`, { headers: authHeaders(session) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Failed to read import state" };
    return { ids: Array.isArray(data.source_submission_ids) ? data.source_submission_ids : [] };
  } catch (err: any) {
    return { error: err?.message ?? "Network error" };
  }
}

async function importBatch(items: unknown): Promise<unknown> {
  const session = await getSession();
  if (!session) return { error: "Not connected" };
  try {
    const res = await fetch(`${session.apiBase}/api/ext/import`, {
      method: "POST",
      headers: { ...authHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Import failed (HTTP ${res.status})` };
    return data;
  } catch (err: any) {
    return { error: err?.message ?? "Network error" };
  }
}

async function getStatus(): Promise<StatusResult> {
  const session = await getSession();
  if (!session) return { connected: false };

  try {
    const res = await fetch(`${session.apiBase}/api/ext/me`, {
      headers: authHeaders(session),
    });
    if (!res.ok) {
      // 401 = revoked/expired token; drop it so the UI prompts a reconnect.
      if (res.status === 401) await clearSession();
      return { connected: false, apiBase: session.apiBase };
    }
    const me = await res.json();
    return {
      connected: true,
      username: me.username ?? null,
      displayName: me.display_name ?? null,
      apiBase: session.apiBase,
    };
  } catch {
    return { connected: false, apiBase: session.apiBase };
  }
}

async function capture(payload: CapturePayload): Promise<CaptureResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not connected" };

  const enriched = await enrichPayload(payload);

  try {
    const res = await fetch(`${session.apiBase}/api/ext/capture`, {
      method: "POST",
      headers: { ...authHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || "Capture failed" };
    return data as CaptureResult;
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Network error" };
  }
}

// The gloaming, storage-backed (T1). The timer is just timestamps in
// chrome.storage.local; elapsed is derived, never counted. We only touch the
// server once, on stop, committing ONE timing_sessions row for the whole solve.
async function timer(
  action: "start" | "pause" | "resume" | "stop",
  payload?: CapturePayload
): Promise<TimerResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not connected" };

  const current = await getActiveTimer();

  if (action === "start") {
    if (!payload) return { success: false, error: "No problem to time on this page." };
    // If a timer is already running for a DIFFERENT problem, commit it first so we
    // never silently drop a solve (and never run two timers at once).
    if (current && current.problemUrl !== payload.url) {
      await commitSession(session, current);
    }
    // Already timing THIS problem -> idempotent (don't fragment); just return state.
    if (current && current.problemUrl === payload.url) {
      return { success: true, action: "start", state: await timerState() };
    }
    const enriched = await enrichPayload(payload);
    const next: ActiveTimer = {
      problemUrl: payload.url,
      platform: payload.platform,
      title: payload.title,
      payload: enriched,
      startedAt: Date.now(),
      accumulatedMs: 0,
      status: "running",
    };
    await setActiveTimer(next);
    return { success: true, action: "start", state: await timerState() };
  }

  if (action === "pause") {
    if (!current) return { success: false, error: "No timer running." };
    if (current.status === "running") {
      const acc = current.accumulatedMs + Math.max(0, Date.now() - current.startedAt);
      await setActiveTimer({ ...current, accumulatedMs: acc, status: "paused" });
    }
    return { success: true, action: "pause", state: await timerState() };
  }

  if (action === "resume") {
    if (!current) return { success: false, error: "No timer to resume." };
    if (current.status === "paused") {
      await setActiveTimer({ ...current, startedAt: Date.now(), status: "running" });
    }
    return { success: true, action: "resume", state: await timerState() };
  }

  // stop: commit one session for the whole accumulated solve, then clear.
  if (!current) return { success: false, error: "No timer running." };
  const result = await commitSession(session, current);
  await clearActiveTimer();
  return { ...result, action: "stop", state: await timerState() };
}

// Commit the accumulated time as a single timing_sessions row. We send explicit
// start/end so pauses collapse into one continuous-looking solve (one solve = one
// session). Returns success + problem_id.
async function commitSession(
  session: ExtSession,
  timer: ActiveTimer
): Promise<TimerResult> {
  const total = elapsedMs(timer);
  // Ignore accidental ~zero sessions (a stray start->stop) so they never pollute history.
  if (total < 1500) return { success: true, stopped: false };
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - total);
  try {
    const res = await fetch(`${session.apiBase}/api/ext/timer`, {
      method: "POST",
      headers: { ...authHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "commit",
        problem: timer.payload,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || "Could not save the session." };
    return { success: true, stopped: true, problem_id: data.problem_id };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Network error" };
  }
}

async function timerState(): Promise<TimerStateResult> {
  const session = await getSession();
  const snap = snapshot(await getActiveTimer());
  return { connected: !!session, ...snap };
}

// Resume/on-file detection: does the user already have this problem (by URL)?
async function checkProblem(url: string): Promise<CheckProblemResult> {
  const session = await getSession();
  if (!session) return { exists: false, error: "Not connected" };
  try {
    const res = await fetch(
      `${session.apiBase}/api/ext/problem?url=${encodeURIComponent(url)}`,
      { headers: authHeaders(session) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { exists: false, error: data.error || "Lookup failed" };
    return { exists: !!data.exists, problem_id: data.problem_id };
  } catch (err: any) {
    return { exists: false, error: err?.message ?? "Network error" };
  }
}

async function attachSolution(
  payload: CapturePayload,
  language: string,
  code: string,
  label?: string
): Promise<SolutionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not connected" };

  const enriched = await enrichPayload(payload);
  try {
    const res = await fetch(`${session.apiBase}/api/ext/solution`, {
      method: "POST",
      headers: { ...authHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify({ problem: enriched, language, code, label }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || "Attach failed" };
    return data as SolutionResult;
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Network error" };
  }
}

// Best-effort enrichment before sending. For Codeforces we add rating + tags from the
// public API (the content script only has reliable url/title/statement/limits). Any
// failure leaves the payload untouched so capture still succeeds.
async function enrichPayload(payload: CapturePayload): Promise<CapturePayload> {
  if (payload.platform !== "codeforces" || !payload.platform_id) return payload;

  const cf = await enrichCodeforces(payload.platform_id);
  if (!cf) return payload;

  const next: CapturePayload = { ...payload };
  if (cf.tags && cf.tags.length) {
    next.source_tags = Array.from(
      new Set([...(payload.source_tags ?? []), ...cf.tags])
    );
  }
  if (typeof cf.rating === "number") {
    next.difficulty_raw = String(cf.rating);
    next.difficulty_norm = ratingToDifficulty(cf.rating);
    next.metadata = { ...(payload.metadata ?? {}), ratingSource: "codeforces-api" };
  }
  return next;
}

function authHeaders(session: ExtSession): Record<string, string> {
  return { Authorization: `Bearer ${session.token}` };
}
