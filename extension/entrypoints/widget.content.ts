import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { parsePage } from "../lib/parsers";
import type {
  CapturePayload,
  TimerStateResult,
  TimerResult,
  CheckProblemResult,
} from "../lib/messages";

// The gloaming, on the judge page (T2). A small, draggable paper "filing slip" that
// lives on Codeforces / LeetCode / AtCoder so the timer is always visible while the
// user reads + codes - no need to reopen the toolbar popup mid-solve.
// It is a thin VIEW over the storage-backed timer (T1): the background owns the
// session; this widget reads a derived snapshot, ticks its own 1s display locally,
// and re-renders whenever chrome.storage's active-timer key changes (so the popup,
// this widget, and a widget in another tab stay in sync). Closing the popup or
// navigating between judge pages loses nothing.
export default defineContentScript({
  matches: [
    "*://codeforces.com/*",
    "*://*.codeforces.com/*",
    "*://leetcode.com/*",
    "*://atcoder.jp/*",
    "*://www.codechef.com/*",
  ],
  // run in the page's main world isn't needed; default isolated world is fine.
  async main() {
    // One widget per top frame only (avoid iframes like editorial embeds).
    if (window.top !== window) return;

    const POS_KEY = "cpj_widget_pos";
    const COLLAPSED_KEY = "cpj_widget_collapsed";

    let payload: CapturePayload | null = null;
    try {
      payload = await parsePage(document, window.location.href);
    } catch {
      payload = null;
    }

    // Host + shadow root so the judge page's CSS can never touch us (and vice-versa).
    const host = document.createElement("div");
    host.id = "cpj-gloaming-host";
    host.style.cssText =
      "position:fixed;z-index:2147483646;top:auto;right:18px;bottom:18px;left:auto;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        /* No remote @import - fetching webfonts from a content script injected across all judge
           pages leaks browsing to a third party and trips store/CSP review. Use local/system fonts. */
        :host { all: initial; }
        .slip {
          width: 188px;
          font-family: Georgia, 'Times New Roman', serif;
          color: #211e18;
          background-color: #f4efe2;
          background-image:
            radial-gradient(130% 80% at 18% -5%, rgba(255,253,245,.6), transparent 52%),
            radial-gradient(120% 95% at 95% 105%, rgba(122,96,52,.07), transparent 55%);
          border: 1px solid #cabf9f;
          border-radius: 3px;
          box-shadow: 0 1px 2px rgba(26,18,10,.22), 0 8px 22px rgba(20,14,8,.34), inset 0 1px 0 rgba(255,253,245,.55);
          padding: 9px 11px 11px;
          position: relative;
          user-select: none;
        }
        /* masking tape */
        .slip::before {
          content:""; position:absolute; top:-7px; left:50%; transform:translateX(-50%) rotate(-2deg);
          width:74px; height:16px; background:rgba(224,210,170,.65);
          box-shadow:0 2px 3px rgba(0,0,0,.16); clip-path:polygon(4% 0,96% 6%,100% 94%,2% 100%);
        }
        .head { display:flex; align-items:center; justify-content:space-between; cursor:grab; }
        .head:active { cursor:grabbing; }
        .gloaming {
          font-family:'JetBrains Mono',ui-monospace,monospace; font-size:8.5px; letter-spacing:.14em;
          text-transform:uppercase; color:#b81d24; display:flex; align-items:center; gap:5px;
        }
        .dot { width:6px; height:6px; border-radius:50%; background:#b81d24; }
        .running .dot { animation: pulse 1.6s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .collapse {
          font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1; color:#8a8266;
          background:none; border:0; cursor:pointer; padding:2px 3px;
        }
        .collapse:hover { color:#b81d24; }
        .elapsed {
          font-family:'JetBrains Mono',monospace; font-size:26px; color:#b81d24;
          font-variant-numeric:tabular-nums; line-height:1.05; margin:3px 0 1px;
        }
        .title {
          font-family:'Newsreader',serif; font-size:11px; color:#6b6450; line-height:1.35;
          max-height:30px; overflow:hidden; margin-bottom:7px;
        }
        .onfile { font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:.06em; color:#4c6b3a; margin:1px 0 7px; }
        .row { display:flex; gap:6px; }
        button.act {
          flex:1; font-family:'Special Elite',monospace; font-size:11px; padding:6px 8px;
          border-radius:2px; border:0; background:#b81d24; color:#fbe9e7; cursor:pointer;
          box-shadow:0 2px 0 #8f141a;
        }
        button.act:active { transform:translateY(2px); box-shadow:0 0 0; }
        button.act.ghost {
          background:transparent; color:#6b6450; border:1px solid #cabf9f; box-shadow:none;
          font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.04em;
        }
        button.act:disabled { opacity:.5; cursor:default; }
        .collapsed-pill {
          display:flex; align-items:center; gap:6px; cursor:pointer;
          font-family:'JetBrains Mono',monospace; font-size:13px; color:#b81d24;
          font-variant-numeric:tabular-nums;
        }
        .hidden { display:none; }
      </style>
      <div class="slip" part="slip"></div>
    `;
    const slip = shadow.querySelector(".slip") as HTMLElement;
    document.documentElement.appendChild(host);

    // ---- restore saved position + collapsed state ----
    const ui = await browser.storage.local.get([POS_KEY, COLLAPSED_KEY]);
    const savedPos = ui[POS_KEY] as { left: number; top: number } | undefined;
    if (savedPos) applyPos(savedPos.left, savedPos.top);
    let collapsed = !!ui[COLLAPSED_KEY];

    function applyPos(left: number, top: number) {
      const l = Math.max(4, Math.min(left, window.innerWidth - 60));
      const t = Math.max(4, Math.min(top, window.innerHeight - 40));
      host.style.left = `${l}px`;
      host.style.top = `${t}px`;
      host.style.right = "auto";
      host.style.bottom = "auto";
    }

    // ---- local 1s display tick (derived, never authoritative) ----
    let tick: ReturnType<typeof setInterval> | undefined;
    let displayMs = 0;
    function stopTick() { if (tick) { clearInterval(tick); tick = undefined; } }
    function startTick() {
      stopTick();
      tick = setInterval(() => {
        displayMs += 1000;
        const el = shadow.querySelector(".elapsed, .collapsed-pill .t");
        if (el) el.textContent = fmt(displayMs);
      }, 1000);
    }

    function fmt(ms: number): string {
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = (n: number) => n.toString().padStart(2, "0");
      return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    }

    async function act(action: "start" | "pause" | "resume" | "stop") {
      const res = (await browser.runtime.sendMessage(
        action === "start"
          ? { type: "TIMER", action, payload }
          : { type: "TIMER", action }
      )) as TimerResult;
      // storage.onChanged will trigger a re-render; render now too for snappiness.
      if (res?.state) renderFrom(res.state);
      else void refresh();
    }

    async function refresh() {
      const state = (await browser.runtime.sendMessage({
        type: "TIMER_STATE",
      })) as TimerStateResult;
      renderFrom(state);
    }

    let onFile = false;
    async function renderFrom(state: TimerStateResult) {
      stopTick();

      // Decide visibility: show if there's an active timer, or we're on a problem
      // page while connected. Otherwise stay out of the way.
      const onProblemPage = !!payload;
      const show = state.active || (state.connected && onProblemPage);
      if (!show) { host.style.display = "none"; return; }
      host.style.display = "block";

      // collapsed pill
      if (collapsed && state.active) {
        slip.classList.remove("running");
        displayMs = state.elapsedMs;
        slip.innerHTML = `
          <div class="collapsed-pill" title="expand the gloaming">
            <span class="dot"></span><span class="t">${fmt(displayMs)}</span>
          </div>`;
        if (state.status === "running") slip.classList.add("running");
        const pill = shadow.querySelector(".collapsed-pill") as HTMLElement;
        pill?.addEventListener("click", () => { collapsed = false; void persistCollapsed(); void refresh(); });
        if (state.status === "running") startTick();
        return;
      }

      if (state.active) {
        displayMs = state.elapsedMs;
        const running = state.status === "running";
        slip.classList.toggle("running", running);
        slip.innerHTML = `
          <div class="head" data-drag>
            <span class="gloaming"><span class="dot"></span>${running ? "the gloaming" : "paused"}</span>
            <button class="collapse" title="collapse">▁</button>
          </div>
          <div class="elapsed">${fmt(displayMs)}</div>
          ${state.title ? `<div class="title">${escapeHtml(state.title)}</div>` : `<div style="height:5px"></div>`}
          <div class="row">
            <button class="act ghost" data-a="${running ? "pause" : "resume"}">${running ? "Pause" : "Resume"}</button>
            <button class="act" data-a="stop">Stop &amp; file</button>
          </div>`;
        if (running) startTick();
      } else {
        // idle on a problem page -> offer to start
        slip.classList.remove("running");
        slip.innerHTML = `
          <div class="head" data-drag>
            <span class="gloaming"><span class="dot" style="background:#8a8266"></span>not timing</span>
            <button class="collapse" title="collapse">▁</button>
          </div>
          ${payload ? `<div class="title">${escapeHtml(payload.title)}</div>` : ""}
          ${onFile ? `<div class="onfile">▸ already on file</div>` : ""}
          <div class="row">
            <button class="act" data-a="start">Start the gloaming</button>
          </div>`;
      }

      // wire buttons
      shadow.querySelectorAll<HTMLButtonElement>("button.act").forEach((b) => {
        b.addEventListener("click", () => void act(b.dataset.a as any));
      });
      const collapseBtn = shadow.querySelector(".collapse") as HTMLButtonElement;
      collapseBtn?.addEventListener("click", () => { collapsed = true; void persistCollapsed(); void refresh(); });
      wireDrag(shadow.querySelector("[data-drag]") as HTMLElement);
    }

    async function persistCollapsed() {
      await browser.storage.local.set({ [COLLAPSED_KEY]: collapsed });
    }

    // ---- dragging the head ----
    function wireDrag(handle: HTMLElement | null) {
      if (!handle) return;
      handle.addEventListener("pointerdown", (e) => {
        if ((e.target as HTMLElement).closest(".collapse")) return;
        const rect = host.getBoundingClientRect();
        const offX = e.clientX - rect.left;
        const offY = e.clientY - rect.top;
        const move = (ev: PointerEvent) => applyPos(ev.clientX - offX, ev.clientY - offY);
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          const r = host.getBoundingClientRect();
          void browser.storage.local.set({ [POS_KEY]: { left: r.left, top: r.top } });
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    }

    function escapeHtml(s: string): string {
      const d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML;
    }

    // ---- keep in sync: re-render when the stored active timer changes ----
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if ("cpj_active_timer" in changes || "cpj_session" in changes) void refresh();
    });

    // best-effort on-file check (doesn't block first paint)
    if (payload) {
      browser.runtime
        .sendMessage({ type: "CHECK_PROBLEM", url: payload.url })
        .then((r: CheckProblemResult) => {
          onFile = !!r?.exists;
          // re-render only if currently idle (don't disturb a running view)
          void refresh();
        })
        .catch(() => {});
    }

    await refresh();
  },
});
