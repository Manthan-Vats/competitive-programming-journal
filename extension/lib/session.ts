// The extension's stored session: the per-user bearer token + the cp-journal API
// base it was minted from (captured during the connect handshake, so the same
// extension build works against localhost in dev and the prod domain in prod).
import { browser } from "wxt/browser";
import type { CapturePayload } from "./messages";

export interface ExtSession {
  token: string;
  apiBase: string;
}

const KEY = "cpj_session";

export async function getSession(): Promise<ExtSession | null> {
  const res = await browser.storage.local.get(KEY);
  return (res[KEY] as ExtSession | undefined) ?? null;
}

export async function setSession(session: ExtSession): Promise<void> {
  await browser.storage.local.set({ [KEY]: session });
}

export async function clearSession(): Promise<void> {
  await browser.storage.local.remove(KEY);
}

// Active timer - the SINGLE source of truth for "the gloaming" (T1 fix).
// MV3 workers + the popup are ephemeral, so we never keep a ticking counter in
// memory. Instead we store timestamps and DERIVE elapsed on every read:
//   elapsed = accumulatedMs + (status  "running" ? Date.now() - startedAt : 0)
// Any surface (popup, floating widget, web app) computes this locally and ticks
// its OWN display interval. Closing the popup / navigating / restarting the
// browser loses nothing because nothing was being counted there. One solve = one
// session: we only commit a single timing_sessions row to the server on stop.

export interface ActiveTimer {
  problemUrl: string;
  platform: string;
  title: string;
  /** Cached capture payload so stop can commit without re-parsing the page. */
  payload: CapturePayload;
  /** Epoch ms when the CURRENT running segment began (meaningless if paused). */
  startedAt: number;
  /** Epoch ms accumulated from previous (paused) segments. */
  accumulatedMs: number;
  status: "running" | "paused";
}

/** A derived, display-ready snapshot of the active timer. */
export interface TimerSnapshot {
  active: boolean;
  status?: "running" | "paused";
  problemUrl?: string;
  title?: string;
  platform?: string;
  elapsedMs: number;
}

const TIMER_KEY = "cpj_active_timer";

export async function getActiveTimer(): Promise<ActiveTimer | null> {
  const res = await browser.storage.local.get(TIMER_KEY);
  return (res[TIMER_KEY] as ActiveTimer | undefined) ?? null;
}

export async function setActiveTimer(timer: ActiveTimer): Promise<void> {
  await browser.storage.local.set({ [TIMER_KEY]: timer });
}

export async function clearActiveTimer(): Promise<void> {
  await browser.storage.local.remove(TIMER_KEY);
}

/** Derived elapsed ms for a timer (or 0 if none). Never stored. */
export function elapsedMs(timer: ActiveTimer | null, now = Date.now()): number {
  if (!timer) return 0;
  const live = timer.status === "running" ? Math.max(0, now - timer.startedAt) : 0;
  return timer.accumulatedMs + live;
}

/** Build a display-ready snapshot for the popup / widget. */
export function snapshot(timer: ActiveTimer | null, now = Date.now()): TimerSnapshot {
  if (!timer) return { active: false, elapsedMs: 0 };
  return {
    active: true,
    status: timer.status,
    problemUrl: timer.problemUrl,
    title: timer.title,
    platform: timer.platform,
    elapsedMs: elapsedMs(timer, now),
  };
}
