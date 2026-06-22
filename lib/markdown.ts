// Tiny, dependency-free Markdown -> HTML renderer for the journal.
// Why hand-rolled: the only Markdown we render is (a) the user's own journal notes and (b) short
// AI-generated free text (critique points, hints, pattern cards). These routinely contain inline
// code (`dp[i]`, `O(n log n)`), **bold**, lists and the occasional ```fenced block```. A full MD
// library is overkill; this is a small, line-based parser that covers exactly those cases and
// escapes everything first so the output is safe to inject.
// Two entry points:
//   renderMarkdown(md)  - block-level: headings, lists, fenced code, paragraphs, plus inline.
//   renderInline(text)  - inline-only (bold/italic/code/links) for places that already supply the
//                         block element (e.g. a single <li> in a structured list).
// IMPORTANT: callers inject the result via dangerouslySetInnerHTML, so this MUST keep escaping the
// raw input before adding any markup.

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Paper-themed inline code chip, used everywhere so AI/notes code reads consistently.
const CODE_CLASS =
  "bg-paper px-1.5 py-0.5 rounded-[2px] text-blood text-[0.92em] font-mono break-words";

// Private-use sentinel used to park inline-code spans while we apply bold/italic/link marks, so
// code contents are never re-parsed and the placeholder can't collide with real text.
const SENTINEL = "";

// Apply inline marks to text that is ALREADY html-escaped.
function applyInline(escaped: string): string {
  const codes: string[] = [];
  let s = escaped.replace(/`([^`]+?)`/g, (_m, code) => {
    codes.push(code);
    return `${SENTINEL}${codes.length - 1}${SENTINEL}`;
  });

  // [text](url) - only http(s) / mailto to avoid javascript: injection.
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_m, text, href) => {
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blueprint underline underline-offset-2 break-words">${text}</a>`;
  });

  s = s
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1<em>$2</em>");

  // restore inline code
  s = s.replace(new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g"), (_m, i) =>
    `<code class="${CODE_CLASS}">${codes[Number(i)]}</code>`,
  );
  return s;
}

export function renderInline(text: string): string {
  if (!text) return "";
  return applyInline(escapeHtml(text));
}

const HEADING_CLASS: Record<number, string> = {
  1: "font-type text-[16px] text-ink mt-4 mb-2",
  2: "font-type text-[15px] text-ink mt-4 mb-2",
  3: "font-type text-[14px] text-ink mt-3 mb-1",
  4: "font-type text-[13px] text-ink mt-3 mb-1",
  5: "font-type text-[13px] text-ink-soft mt-2 mb-1",
  6: "font-type text-[12px] text-ink-soft mt-2 mb-1",
};

export function renderMarkdown(md: string): string {
  if (!md) return "";
  const lines = escapeHtml(md).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  let i = 0;
  // list buffering
  let listType: "ul" | "ol" | null = null;
  const listItems: string[] = [];
  // paragraph buffering
  let para: string[] = [];

  const flushList = () => {
    if (!listType) return;
    const tag = listType;
    const cls =
      tag === "ul"
        ? "list-disc list-outside pl-5 space-y-1 my-2"
        : "list-decimal list-outside pl-5 space-y-1 my-2";
    out.push(
      `<${tag} class="${cls}">${listItems.map((it) => `<li>${applyInline(it)}</li>`).join("")}</${tag}>`,
    );
    listItems.length = 0;
    listType = null;
  };

  const flushPara = () => {
    if (para.length === 0) return;
    out.push(`<p class="my-2 leading-[1.6]">${applyInline(para.join("<br />"))}</p>`);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block ``` (optionally with a language tag, which we ignore for highlighting)
    if (/^\s*```/.test(line)) {
      flushPara();
      flushList();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push(
        `<pre class="bg-paper rounded-[3px] p-3 my-2 overflow-x-auto text-[12px] font-mono leading-[1.55] text-ink"><code>${body.join("\n")}</code></pre>`,
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      const tag = `h${Math.min(level + 2, 6)}`; // markdown # -> h3 ... ###### -> h6
      out.push(`<${tag} class="${HEADING_CLASS[level]}">${applyInline(h[2])}</${tag}>`);
      i++;
      continue;
    }

    // unordered list item
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ul[1]);
      i++;
      continue;
    }

    // ordered list item
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(ol[1]);
      i++;
      continue;
    }

    // blank line -> break paragraph/list
    if (line.trim() === "") {
      flushPara();
      flushList();
      i++;
      continue;
    }

    // plain text -> paragraph (lists end on a non-list line)
    flushList();
    para.push(line);
    i++;
  }

  flushPara();
  flushList();
  return out.join("");
}
