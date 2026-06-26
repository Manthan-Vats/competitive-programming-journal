// Themed, dependency-free SVG generator for the shareable "case-file" achievement card (P3 share).
// The card is the show-off artifact: a Radiohead-paper-styled SVG that embeds in a GitHub README
// or personal site via ![](.../api/card/<user>) and auto-updates. It renders ONLY verified, pulled
// stats (the route enforces status=verified), names the issuer (CP Journal), and points at the
// one-click verify page - the three things a trustworthy credential needs.
// Plain hand-written SVG (not Satori) so it stays crisp, tiny and cache-friendly, and renders in
// GitHub's sanitized <img> context using system fonts only. All user-supplied text is XML-escaped.

import { type VerifyStats } from "@/lib/verify";

//  palette (mirrors app/globals.css @theme so the card matches the journal)
const C = {
  paper: "#efe9d9",
  sheet: "#f4efe2",
  edge: "#d8d0bb",
  ink: "#211e18",
  inkSoft: "#564e3b",
  inkFaint: "#6e664f",
  blood: "#b81d24",
  bloodDeep: "#8f141a",
  green: "#4c6b3a",
  blueprint: "#36545f",
};

const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";

const PLATFORM_LABEL: Record<string, string> = {
  codeforces: "CODEFORCES",
  leetcode: "LEETCODE",
  github: "GITHUB",
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CardVerification {
  platform: string;
  stats: VerifyStats;
}

export interface CardData {
  displayName: string;
  username: string;
  origin: string;
  verifs: CardVerification[];
  journaled: number;
  patterns: number;
  issuedAt: string | null; // ISO; latest verified_at
  credentialId: string;
}

// One stat line: label + value, e.g. "CODEFORCES" / "1500 · 210 solved".
function statLine(platform: string, stats: VerifyStats): { label: string; value: string } {
  const label = PLATFORM_LABEL[platform] ?? platform.toUpperCase();
  if (platform === "codeforces") {
    const bits = [
      typeof stats.rating === "number" ? `${stats.rating}` : null,
      typeof stats.solved === "number" ? `${stats.solved} solved` : null,
    ].filter(Boolean);
    return { label, value: bits.join(" · ") || "verified" };
  }
  if (platform === "leetcode") {
    return { label, value: typeof stats.solved === "number" ? `${stats.solved} solved` : "verified" };
  }
  if (platform === "github") {
    return { label, value: typeof stats.publicRepos === "number" ? `${stats.publicRepos} repos` : "verified" };
  }
  return { label, value: "verified" };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// Stamp glyph (rotated, blood double-border, reading VERIFIED) drawn at the given top-right anchor.
function stampSvg(x: number, y: number): string {
  return `
  <g transform="translate(${x} ${y}) rotate(-7)">
    <rect x="0" y="0" width="118" height="40" rx="3" fill="none" stroke="${C.blood}" stroke-width="2.5" opacity="0.92"/>
    <rect x="4" y="4" width="110" height="32" rx="2" fill="none" stroke="${C.blood}" stroke-width="1" opacity="0.55"/>
    <text x="59" y="25" text-anchor="middle" font-family="${MONO}" font-size="15" font-weight="700" letter-spacing="2" fill="${C.blood}">VERIFIED</text>
  </g>`;
}

function host(origin: string): string {
  return origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

//  combined "achievement" card
export function buildCombinedCardSvg(d: CardData): string {
  const W = 520;
  const PAD = 30;
  const verified = d.verifs.length > 0;

  // body lines: one per verified platform, then a journal-depth line
  const lines = d.verifs.map((v) => statLine(v.platform, v.stats));
  lines.push({ label: "JOURNAL", value: `${d.journaled} logged · ${d.patterns} patterns` });

  const headY = PAD + 14;
  const nameY = headY + 52;
  const userY = nameY + 26;
  const ruleY = userY + 20;
  const firstStatY = ruleY + 34;
  const GAP = 30;
  const lastStatY = firstStatY + (lines.length - 1) * GAP;
  const footY = lastStatY + 40;
  const H = footY + 24;

  const statRows = lines
    .map((ln, i) => {
      const y = firstStatY + i * GAP;
      const isJournal = ln.label === "JOURNAL";
      const tick = isJournal
        ? ""
        : `<text x="${W - PAD}" y="${y}" text-anchor="end" font-family="${MONO}" font-size="15" fill="${C.green}">✓</text>`;
      return `
    <text x="${PAD}" y="${y}" font-family="${MONO}" font-size="12.5" letter-spacing="1.5" fill="${C.inkFaint}">${esc(ln.label)}</text>
    <text x="${PAD + 132}" y="${y}" font-family="${SERIF}" font-size="17" fill="${C.ink}">${esc(ln.value)}</text>
    ${tick}`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.displayName)} - SolveLog verified card">
  <defs>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.sheet}"/>
      <stop offset="1" stop-color="${C.paper}"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" fill="url(#sheen)" stroke="${C.edge}" stroke-width="2"/>
  <rect x="7" y="7" width="${W - 14}" height="${H - 14}" rx="4" fill="none" stroke="${C.edge}" stroke-width="1" opacity="0.7"/>
  <!-- header -->
  <rect x="${PAD}" y="${headY - 11}" width="11" height="11" fill="${C.blood}" rx="2"/>
  <text x="${PAD + 19}" y="${headY}" font-family="${MONO}" font-size="12.5" letter-spacing="3" fill="${C.inkFaint}">SOLVELOG · CASE FILE</text>
  ${verified ? stampSvg(W - PAD - 110, headY - 16) : ""}
  <!-- identity -->
  <text x="${PAD}" y="${nameY}" font-family="${SERIF}" font-size="34" font-weight="700" fill="${C.ink}">${esc(d.displayName)}</text>
  <text x="${PAD}" y="${userY}" font-family="${MONO}" font-size="14" fill="${C.inkSoft}">@${esc(d.username)}</text>
  <!-- rule -->
  <line x1="${PAD}" y1="${ruleY}" x2="${W - PAD}" y2="${ruleY}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="2 4" opacity="0.45"/>
  <!-- stats -->
  ${statRows}
  <!-- footer -->
  <line x1="${PAD}" y1="${footY - 22}" x2="${W - PAD}" y2="${footY - 22}" stroke="${C.edge}" stroke-width="1"/>
  <text x="${PAD}" y="${footY}" font-family="${MONO}" font-size="11" fill="${C.inkFaint}">${verified ? `verified · ${esc(fmtDate(d.issuedAt))}` : "unverified"}</text>
  <text x="${W - PAD}" y="${footY}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.blood}">verify → ${esc(host(d.origin))}/u/${esc(d.username)}</text>
</svg>`;
}

//  single-platform card (compact)
export function buildPlatformCardSvg(d: CardData, platform: string): string {
  const W = 400;
  const PAD = 26;
  const v = d.verifs.find((x) => x.platform === platform);
  const ln = v ? statLine(platform, v.stats) : { label: PLATFORM_LABEL[platform] ?? platform.toUpperCase(), value: "unverified" };
  const verified = !!v;

  const headY = PAD + 12;
  const valueY = headY + 46;
  const footY = valueY + 40;
  const H = footY + 22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.displayName)} - ${esc(ln.label)} verified">
  <defs>
    <linearGradient id="sheen2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.sheet}"/>
      <stop offset="1" stop-color="${C.paper}"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" fill="url(#sheen2)" stroke="${C.edge}" stroke-width="2"/>
  <rect x="${PAD - 6}" y="${PAD - 6}" width="4" height="${H - 2 * PAD + 12}" fill="${verified ? C.green : C.edge}" rx="2"/>
  <text x="${PAD + 8}" y="${headY}" font-family="${MONO}" font-size="12.5" letter-spacing="2.5" fill="${C.inkFaint}">${esc(ln.label)}</text>
  ${verified ? `<text x="${W - PAD}" y="${headY}" text-anchor="end" font-family="${MONO}" font-size="13" fill="${C.green}">VERIFIED ✓</text>` : ""}
  <text x="${PAD + 8}" y="${valueY}" font-family="${SERIF}" font-size="28" font-weight="700" fill="${C.ink}">${esc(ln.value)}</text>
  <line x1="${PAD + 8}" y1="${footY - 20}" x2="${W - PAD}" y2="${footY - 20}" stroke="${C.edge}" stroke-width="1"/>
  <text x="${PAD + 8}" y="${footY}" font-family="${MONO}" font-size="10.5" fill="${C.blood}">${esc(host(d.origin))}/u/${esc(d.username)}</text>
</svg>`;
}
