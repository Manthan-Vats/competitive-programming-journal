import { browser } from "wxt/browser";
import type {
  StatusResult,
  CaptureResult,
  ParsePageResult,
  CapturePayload,
  TimerResult,
  TimerStateResult,
  CheckProblemResult,
  SolutionResult,
} from "../../lib/messages";

// Default cp-journal instance used for the connect link (dev). For a prod instance,
// change this to your deployed domain (and add it to wxt.config host_permissions +
// connect.content.ts matches).
const DEFAULT_APP_BASE = "http://localhost:3000";

const statusEl = document.getElementById("status")!;
const actionsEl = document.getElementById("actions")!;
const hintEl = document.getElementById("hint")!;

function setHint(msg: string) {
  hintEl.textContent = msg;
}

async function render() {
  statusEl.textContent = "checking...";
  actionsEl.innerHTML = "";
  hintEl.textContent = "";

  const status = (await browser.runtime.sendMessage({
    type: "GET_STATUS",
  })) as StatusResult;

  if (status?.connected) {
    const who = status.username
      ? `@${status.username}`
      : status.displayName || "your journal";
    statusEl.innerHTML = `<span class="dot on"></span>connected · ${escapeHtml(who)}`;

    // The gloaming - live, stateful timer panel (storage-backed; survives popup close).
    const timerPanel = document.createElement("div");
    timerPanel.id = "timer-panel";
    actionsEl.appendChild(timerPanel);
    void renderTimer(timerPanel);

    actionsEl.appendChild(
      button("Capture this problem", "", () => void captureActive())
    );

    actionsEl.appendChild(
      button("Attach solution", "ghost", () => showSolutionForm())
    );

    actionsEl.appendChild(
      button("Disconnect", "ghost", async () => {
        await browser.runtime.sendMessage({ type: "DISCONNECT" });
        render();
      })
    );
    setHint(
      "Open a supported problem page, then capture / time / attach a solution. " +
        "Bulk history sync lives in the web app under Settings."
    );
  } else {
    statusEl.innerHTML = `<span class="dot off"></span>not connected`;

    const base = status?.apiBase || DEFAULT_APP_BASE;
    actionsEl.appendChild(
      button("Connect", "", async () => {
        await browser.tabs.create({ url: `${base}/extension/connect` });
        window.close();
      })
    );
    setHint(`Log into ${base} and click Connect to link this extension to your journal.`);
  }
}

// Ask the active tab's content script to parse the current problem page.
async function getActivePayload(): Promise<CapturePayload | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    const parsed = (await browser.tabs.sendMessage(tab.id, {
      type: "PARSE_PAGE",
    })) as ParsePageResult;
    return parsed?.payload ?? null;
  } catch {
    // No content script on this tab -> not a supported problem page.
    return null;
  }
}

const NOT_A_PROBLEM =
  "Open a supported problem page (CF / LeetCode / AtCoder / CodeChef) and try again.";

async function captureActive() {
  setHint("Reading this page...");
  const payload = await getActivePayload();
  if (!payload) return setHint(NOT_A_PROBLEM);

  setHint("Saving...");
  const result = (await browser.runtime.sendMessage({
    type: "CAPTURE",
    payload,
  })) as CaptureResult;
  if (result?.success) {
    setHint(
      result.was_duplicate
        ? "Already in your journal."
        : "Captured. It's in your journal."
    );
  } else {
    setHint(result?.error || "Capture failed.");
  }
}

//  The gloaming (timer)

let tickInterval: ReturnType<typeof setInterval> | undefined;

function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

async function timerAction(action: "start" | "pause" | "resume" | "stop", payload?: CapturePayload) {
  const result = (await browser.runtime.sendMessage({
    type: "TIMER",
    action,
    payload,
  })) as TimerResult;
  if (!result?.success) setHint(result?.error || "Timer failed.");
  else if (action === "stop") setHint(result.stopped ? "Filed the gloaming." : "Stopped.");
  const panel = document.getElementById("timer-panel");
  if (panel) await renderTimer(panel);
}

async function renderTimer(panel: HTMLElement) {
  if (tickInterval) { clearInterval(tickInterval); tickInterval = undefined; }
  panel.innerHTML = "";

  const state = (await browser.runtime.sendMessage({ type: "TIMER_STATE" })) as TimerStateResult;

  const box = document.createElement("div");
  box.className = "timer";

  if (state?.active) {
    const running = state.status === "running";
    const head = document.createElement("div");
    head.className = "timer-head";
    head.innerHTML =
      `<span class="gloaming">${running ? "the gloaming" : "paused"}</span>` +
      `<span class="elapsed" id="elapsed">${fmtElapsed(state.elapsedMs)}</span>`;
    box.appendChild(head);

    if (state.title) {
      const t = document.createElement("div");
      t.className = "timer-title";
      t.textContent = state.title;
      box.appendChild(t);
    }

    const row = document.createElement("div");
    row.className = "row";
    row.appendChild(
      button(running ? "Pause" : "Resume", "ghost", () =>
        void timerAction(running ? "pause" : "resume")
      )
    );
    row.appendChild(button("Stop & file", "", () => void timerAction("stop")));
    box.appendChild(row);

    // tick the display locally from the derived elapsed; closing the popup loses nothing.
    if (running) {
      let ms = state.elapsedMs;
      tickInterval = setInterval(() => {
        ms += 1000;
        const el = document.getElementById("elapsed");
        if (el) el.textContent = fmtElapsed(ms);
      }, 1000);
    }
  } else {
    const payload = await getActivePayload();
    if (!payload) {
      const note = document.createElement("div");
      note.className = "timer-idle";
      note.textContent = "Open a problem page to start the gloaming.";
      box.appendChild(note);
    } else {
      const note = document.createElement("div");
      note.className = "timer-idle";
      note.textContent = payload.title;
      box.appendChild(note);

      // on-file hint (resume detection) - best-effort.
      const check = (await browser.runtime.sendMessage({
        type: "CHECK_PROBLEM",
        url: payload.url,
      })) as CheckProblemResult;
      if (check?.exists) {
        const onfile = document.createElement("div");
        onfile.className = "timer-onfile";
        onfile.textContent = "▸ already on file";
        box.appendChild(onfile);
      }

      box.appendChild(
        button("Start the gloaming", "", () => void timerAction("start", payload))
      );
    }
  }

  panel.appendChild(box);
}

const LANGUAGES: [string, string][] = [
  ["cpp", "C++"],
  ["python", "Python"],
  ["java", "Java"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["js", "JavaScript"],
  ["other", "Other"],
];

// File-upload allowlist + guards, mirroring the web editor (components/code-editor.tsx). The
// file is read as TEXT only (never executed) and sent through the exact same ATTACH_SOLUTION
// path as pasted code, so there's no new attack surface - the server re-validates language +
// size, and code is rendered escaped. This is purely a convenience input.
const EXT_LANG: Record<string, string> = {
  cpp: "cpp", cc: "cpp", cxx: "cpp", "c++": "cpp", c: "cpp", h: "cpp", hpp: "cpp", hh: "cpp",
  py: "python", pyw: "python",
  java: "java",
  go: "go",
  rs: "rust",
  js: "js", jsx: "js", ts: "js", tsx: "js", mjs: "js", cjs: "js",
  txt: "other", kt: "other", cs: "other", rb: "other", swift: "other", scala: "other",
  php: "other", sql: "other", sh: "other",
};
const ACCEPT_EXTS = Object.keys(EXT_LANG).map((e) => "." + e).join(",");
const MAX_CODE_BYTES = 256 * 1024; // 256 KB

// Reject binary / non-text files disguised as source (e.g. a renamed .exe). A real source
// file is printable UTF-8: no NUL bytes and only a tiny fraction of control characters.
function looksLikeSourceText(text: string): boolean {
  if (text.length === 0) return false;
  const sample = text.slice(0, 4096);
  let control = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0) return false; // NUL => binary
    if (c < 9 || (c > 13 && c < 32) || c === 0xfffd) control++;
  }
  return control / sample.length < 0.02;
}

function showSolutionForm() {
  if (document.getElementById("sol-form")) return; // already open

  const form = document.createElement("div");
  form.id = "sol-form";

  const lang = document.createElement("select");
  for (const [value, label] of LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    lang.appendChild(opt);
  }

  const code = document.createElement("textarea");
  code.placeholder = "Paste your solution code...";

  // Upload-from-file (alternative to pasting). Reads as TEXT only; same secure path as paste.
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ACCEPT_EXTS;
  fileInput.style.display = "none";
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = ""; // allow re-picking the same file
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const mapped = EXT_LANG[ext];
    if (!mapped) return setHint(`Unsupported file type ".${ext}" - upload a source file.`);
    if (file.size > MAX_CODE_BYTES) return setHint("File too large - keep solutions under 256 KB.");
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!looksLikeSourceText(text)) {
        return setHint("That file isn't source code (binary/non-text). Upload your solution file.");
      }
      code.value = text;
      if (ext !== "txt") lang.value = mapped;
      setHint(`Loaded ${file.name} - review, then Attach.`);
    };
    reader.onerror = () => setHint("Could not read that file.");
    reader.readAsText(file); // TEXT only - never executed
  });
  const uploadBtn = button("Upload file", "ghost", () => fileInput.click());

  const submit = button("Attach", "", async () => {
    if (!code.value.trim()) return setHint("Paste some code first.");
    const payload = await getActivePayload();
    if (!payload) return setHint(NOT_A_PROBLEM);

    submit.disabled = true;
    setHint("Attaching solution...");
    const result = (await browser.runtime.sendMessage({
      type: "ATTACH_SOLUTION",
      payload,
      language: lang.value,
      code: code.value,
    })) as SolutionResult;
    submit.disabled = false;

    if (result?.success) {
      setHint("Solution attached - analyze it from the web app.");
      code.value = "";
    } else {
      setHint(result?.error || "Attach failed.");
    }
  });

  form.appendChild(lang);
  form.appendChild(code);
  form.appendChild(uploadBtn);
  form.appendChild(fileInput);
  form.appendChild(submit);
  actionsEl.appendChild(form);
}

function button(
  label: string,
  cls: string,
  onClick: () => void
): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener("click", onClick);
  return b;
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

render();
