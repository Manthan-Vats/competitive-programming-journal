// Readable plain-text extraction from judge problem statements that use MathJax.
// THE BUG THIS FIXES: MathJax v2 (used by Codeforces) renders each formula THREE times in
// the DOM - the visible glyphs (`.MathJax`), an off-screen screen-reader copy
// (`.MJX_Assistive_MathML`, per MathJax 2.7 AssistiveMML), and the original LaTeX source
// (`<script type="math/tex">`). A naive `textContent` concatenates all three, producing
// garbled output like `1≤t≤1031≤t≤1031 \le t \le 10^3` / `ttt` / `nnn`.
// FIX: drop the two rendered duplicates, keep ONE copy = the LaTeX source, and convert
// that source into readable Unicode-ish text (≤, superscripts, ...). Then serialize the DOM
// block-aware so paragraphs/sections don't run together (`...are not.InputEach...`).
// Refs: MathJax 2.7 AssistiveMML (.MJX_Assistive_MathML); v2 math/tex source scripts.

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶",
  "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽",
  ")": "⁾", n: "ⁿ", i: "ⁱ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆",
  "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
};

function toScript(
  inner: string,
  map: Record<string, string>,
  wrap: (s: string) => string
): string {
  const chars = [...inner];
  if (chars.length > 0 && chars.every((c) => map[c])) {
    return chars.map((c) => map[c]).join("");
  }
  // Lone footnote markers like ∗ † ‡ read better bare than as "^(∗)".
  if (chars.length === 1 && /[^A-Za-z0-9]/.test(inner)) return inner;
  return wrap(inner);
}

// Convert a LaTeX fragment (a Codeforces math/tex source) into readable text. Best-effort
// and bounded - it covers the operators/notation common in competitive-programming
// statements; anything unknown degrades to its plain name (e.g. \max -> max).
export function latexToReadable(srcRaw: string): string {
  let s = srcRaw;

  // 1. Strip text/format wrappers, keep the inner content (iterate for light nesting).
  const wrappers =
    /\\(?:text|texttt|textbf|textit|textrm|textsf|mathbf|mathrm|mathit|mathcal|mathbb|mathsf|operatorname|emph|boldsymbol)\s*\{([^{}]*)\}/g;
  for (let i = 0; i < 6 && wrappers.test(s); i++) {
    s = s.replace(wrappers, "$1");
    wrappers.lastIndex = 0;
  }

  // 2. Fractions and roots.
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");

  // 3. Relations, operators, symbols, and common Greek letters.
  const SYM: [RegExp, string][] = [
    [/\\leq\b/g, "≤"], [/\\geq\b/g, "≥"], [/\\neq\b/g, "≠"],
    [/\\le\b/g, "≤"], [/\\ge\b/g, "≥"], [/\\ne\b/g, "≠"],
    [/\\approx\b/g, "≈"], [/\\equiv\b/g, "≡"], [/\\sim\b/g, "∼"],
    [/\\times\b/g, "×"], [/\\cdot\b/g, "·"], [/\\div\b/g, "÷"],
    [/\\pm\b/g, "±"], [/\\mp\b/g, "∓"],
    [/\\ldots\b|\\cdots\b|\\dots\b/g, "..."], [/\\infty\b/g, "∞"],
    [/\\rightarrow\b|\\to\b/g, "→"], [/\\leftarrow\b/g, "←"],
    [/\\Rightarrow\b/g, "⇒"], [/\\Leftarrow\b/g, "⇐"],
    [/\\sum\b/g, "Σ"], [/\\prod\b/g, "∏"],
    [/\\in\b/g, "∈"], [/\\notin\b/g, "∉"],
    [/\\subseteq\b/g, "⊆"], [/\\subset\b/g, "⊂"],
    [/\\cup\b/g, "∪"], [/\\cap\b/g, "∩"],
    [/\\bmod\b|\\mod\b/g, " mod "],
    [/\\alpha\b/g, "α"], [/\\beta\b/g, "β"], [/\\gamma\b/g, "γ"], [/\\delta\b/g, "δ"],
    [/\\epsilon\b|\\varepsilon\b/g, "ε"], [/\\theta\b/g, "θ"], [/\\lambda\b/g, "λ"],
    [/\\mu\b/g, "μ"], [/\\pi\b/g, "π"], [/\\sigma\b/g, "σ"], [/\\phi\b/g, "φ"],
    [/\\omega\b/g, "ω"], [/\\Delta\b/g, "Δ"],
  ];
  for (const [re, rep] of SYM) s = s.replace(re, rep);

  // 4. Spacing commands.
  s = s.replace(/\\[,;:]/g, " ").replace(/\\!/g, "").replace(/\\q?quad\b/g, " ");

  // 5. Superscripts / subscripts (braced form first, then single char).
  s = s.replace(/\^\{([^{}]*)\}/g, (_m, g) => toScript(g, SUP, (x) => "^(" + x + ")"));
  s = s.replace(/\^(\S)/g, (_m, g) => toScript(g, SUP, (x) => "^" + x));
  s = s.replace(/_\{([^{}]*)\}/g, (_m, g) => toScript(g, SUB, (x) => "_(" + x + ")"));
  s = s.replace(/_(\S)/g, (_m, g) => toScript(g, SUB, (x) => "_" + x));

  // 6. Any remaining command -> its bare name (e.g. \max -> max). Then drop stray
  //    backslashes/braces and collapse whitespace.
  s = s.replace(/\\\\/g, " ");
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");
  s = s.replace(/[\\{}]/g, "");
  return s.replace(/\s+/g, " ").trim();
}

const BLOCK = new Set([
  "DIV", "P", "LI", "UL", "OL", "TR", "TABLE", "PRE", "SECTION",
  "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE",
]);

// Block-aware text walk (numeric nodeType keeps this independent of any global `Node`, so
// it runs both in the content script and under test). Adds newlines around block elements
// and for <br> so sections don't run together.
function walk(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out += child.textContent ?? "";
    } else if (child.nodeType === 1) {
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      if (tag === "BR") {
        out += "\n";
        return;
      }
      const block = BLOCK.has(tag);
      if (block) out += "\n";
      out += walk(el);
      if (block) out += "\n";
    }
  });
  return out;
}

// Extract readable plain text from a problem-statement element. MUTATES the passed
// element (pass a clone), removing MathJax render duplicates and replacing each math
// source with its readable form, then serializes block-aware.
export function extractReadableText(el: Element): string {
  // Drop the visible glyph render + the off-screen assistive MathML duplicate (+ v3).
  el.querySelectorAll(
    ".MathJax_Preview, .MathJax, .MathJax_Display, .MJX_Assistive_MathML, mjx-container"
  ).forEach((n) => n.remove());

  // Replace each LaTeX source script with its readable text (the one copy we keep).
  el.querySelectorAll('script[type^="math/tex"]').forEach((scriptEl) => {
    const tex = latexToReadable(scriptEl.textContent ?? "");
    scriptEl.replaceWith(scriptEl.ownerDocument.createTextNode(tex));
  });

  // Any other non-content nodes.
  el.querySelectorAll("script, style").forEach((n) => n.remove());

  const raw = walk(el);
  // Normalize: trim each line, drop empties, collapse runs, cap blank lines.
  return raw
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
