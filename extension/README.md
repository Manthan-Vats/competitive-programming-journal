# SolveLog Companion (browser extension)

Cross-browser extension (built with [WXT](https://wxt.dev)) that captures
coding problems into your [SolveLog](../) - one-click capture with rich
metadata (rating, tags, statement, limits), a per-problem timer, and bulk history import.

## Supported sites

| Judge | What's captured | Source |
|-------|-----------------|--------|
| **Codeforces** | title, id, statement, time/memory limits, **rating + tags** | live DOM + `problemset.problems` API (cached) |
| **LeetCode** | title, id, difficulty, topic tags, statement | `question` GraphQL (same-origin) |
| **AtCoder** | title, task id, statement (English), time/memory limits | live DOM (`#task-statement`) |
| **CodeChef** | title, code, difficulty, statement | `/api/contests/<c>/problems/<code>` |

Statements are stored as readable plain text - MathJax/LaTeX is de-duplicated and converted
to Unicode (`≤`, `10³`, ...) by `lib/parsers/mathjax.ts`. Add a judge by writing a parser in
`lib/parsers/`, registering it in `lib/parsers/index.ts`, and adding its URL to the
`matches` in `entrypoints/judge.content.ts`.

## How auth works (no shared secret)

Each user links the extension to their own journal with a **per-user bearer token**:

1. Log into the SolveLog web app, open **`/extension/connect`**, click **Connect**.
2. That page mints a token (same-origin, so your Supabase session authenticates it) and hands
   it to the extension via `window.postMessage`. The `connect` content script relays it to the
   background worker, which stores it in `chrome.storage.local` along with the app's origin.
3. The extension calls the app's `/api/ext/*` endpoints with `Authorization: Bearer <token>`.
   Tokens are listable/revocable from the web app (`/api/ext/tokens`).

## Build

```bash
cd extension
npm install            # runs `wxt prepare` (generates .wxt/ types)
npm run build          # Chrome/Chromium (MV3) -> .output/chrome-mv3
npm run build:firefox  # Firefox (MV2)         -> .output/firefox-mv2
npm run compile        # type-check
npx tsx test/<name>.test.ts   # parser unit tests (jsdom)
```

## Install (load the built extension)

The same **`.output/chrome-mv3`** build works on all Chromium browsers (Chrome, Brave, Edge).

- **Chrome / Brave:** go to `chrome://extensions` (Brave: `brave://extensions`) -> enable
  **Developer mode** -> **Load unpacked** -> select `extension/.output/chrome-mv3`.
- **Edge:** go to `edge://extensions` -> enable **Developer mode** -> **Load unpacked** ->
  select `extension/.output/chrome-mv3`.
- **Firefox:** go to `about:debugging#/runtime/this-firefox` -> **Load Temporary Add-on...** ->
  select any file inside `extension/.output/firefox-mv2` (e.g. `manifest.json`). (Temporary
  add-ons are removed on restart; permanent install requires AMO signing - see below.)

> **After loading or rebuilding**, reload any already-open judge tab - MV3 only injects the
> content script into pages opened *after* the extension loads.

Then open the popup -> **Connect** (links to your SolveLog) -> open a supported problem page ->
**Capture this problem**. It appears in your dashboard live (no refresh).

## Configure for production

The dev build targets `http://localhost:3000`. For a deployed instance, add your domain to:

- `wxt.config.ts` -> `manifest.host_permissions`
- `entrypoints/connect.content.ts` -> `matches`
- `entrypoints/popup/main.ts` -> `DEFAULT_APP_BASE`

## Status

- **S0 (web app side):** done - `extension_tokens` table, `/api/ext/{link,me,capture,tokens}`,
  `/extension/connect` page; migration `004` adds `statement`/`metadata` + realtime.
- **S1 (scaffold + auth handshake):** done - background, connect content script, popup.
- **S2 (capture):** done - lean per-judge parsers (Codeforces, LeetCode, AtCoder, CodeChef)
  with metadata + readable statement; live dashboard updates via Supabase Realtime.
- **S3 (timer / solution attach), S4 (import):** next.

### Distribution (later)

For permanent install / store listing: Chromium -> Chrome Web Store (zip via `npm run zip`);
Firefox -> AMO signing (`npm run zip:firefox`), which also needs
`browser_specific_settings.gecko.id` and a `data_collection_permissions` declaration
(Firefox warns about this at build time as of Nov 2025).
