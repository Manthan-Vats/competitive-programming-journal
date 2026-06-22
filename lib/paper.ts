/**
 * Paper kit helpers - deterministic imperfection + topic-chip colours.
 * Keeps the "lightly handled" look stable across renders (00_FOUNDATIONS §2.4).
 */

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Deterministic tiny rotation per id (±maxDeg), stable across renders. */
export function seededRotation(id: string, maxDeg = 0.6): number {
  const r = (hash(id) % 1000) / 1000; // 0..1
  return +((r * 2 - 1) * maxDeg).toFixed(2);
}

/** difficulty_norm -> edge-tab / chip colour token (paper difficulty map). */
export const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "var(--color-easy)",
  medium: "var(--color-medium)",
  hard: "var(--color-hard)",
  expert: "var(--color-expert)",
  unknown: "var(--color-unknown)",
};

/** Paired chip colours (bg/text) - AA contrast, from the HttT set. */
const CHIP_PALETTE: { bg: string; text: string }[] = [
  { bg: "var(--color-t-yellow)", text: "#231a00" },
  { bg: "var(--color-t-blue)", text: "#e7f1f3" },
  { bg: "var(--color-t-green)", text: "#eef3e6" },
  { bg: "var(--color-t-orange)", text: "#231300" },
  { bg: "var(--color-t-red)", text: "#fbeae6" },
];

const NEUTRAL_CHIP = { bg: "#dcd4bf", text: "#5b5640" };

/**
 * Stable colour for a topic chip. A small set of "headline" paradigms get a
 * loud HttT colour; everything else is the neutral filed-tag colour. This keeps
 * cards calm (one or two colours) rather than a rainbow per the spec.
 */
const HEADLINE_TOPICS = new Set([
  "greedy",
  "dp",
  "dynamic programming",
  "math",
  "graphs",
  "graph",
  "trees",
  "tree",
  "geometry",
  "strings",
  "bitmasks",
  "two pointers",
  "two-pointers",
  "binary search",
]);

export function chipColors(tag: string): { bg: string; text: string } {
  const t = tag.toLowerCase().trim();
  if (HEADLINE_TOPICS.has(t)) {
    return CHIP_PALETTE[hash(t) % CHIP_PALETTE.length];
  }
  return NEUTRAL_CHIP;
}
