// Server-side HTML → readable plain text (no DOM / jsdom dependency).
// Used to turn LeetCode's `question.content` HTML (which we fetch anonymously during
// import) into the stored plain-text `statement`. Block-aware: inserts newlines around
// block elements so sections don't run together; normalizes <sup>/<sub> to ^/_ so
// exponents stay readable; decodes the common named + numeric HTML entities. Mirrors the
// intent of the extension's DOM-based extractReadableText, but runs in Node.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", le: "≤", ge: "≥", times: "×", minus: "−",
  middot: "·", hellip: "...", rarr: "→", larr: "←", mdash: "-", ndash: "-",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e] ?? m;
  });
}

export function htmlToReadableText(html: string): string {
  if (typeof html !== "string" || !html) return "";
  let s = html;

  // Drop script/style content entirely.
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Exponents / subscripts → readable inline form before stripping tags.
  s = s.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, "^$1");
  s = s.replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, "_$1");

  // List items get a bullet; block-level closers become newlines.
  s = s.replace(/<li[^>]*>/gi, "• ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|ul|ol|pre|h[1-6]|tr|table|blockquote)>/gi, "\n");

  // Strip all remaining tags, then decode entities.
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);

  // Normalize whitespace: trim line edges, collapse runs, cap blank lines.
  s = s
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}
