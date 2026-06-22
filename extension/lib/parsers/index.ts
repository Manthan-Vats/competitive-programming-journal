import type { CapturePayload } from "../messages";
import { codeforcesParser } from "./codeforces";
import { leetcodeParser } from "./leetcode";
import { atcoderParser } from "./atcoder";
import { codechefParser } from "./codechef";
import type { JudgeParser } from "./types";

// Registry of judge parsers.
const PARSERS: JudgeParser[] = [
  codeforcesParser,
  leetcodeParser,
  atcoderParser,
  codechefParser,
];

// Parse the given page with whichever parser matches its URL. Returns null if no parser
// handles this URL or the page isn't a complete problem page. Async because some parsers
// (e.g. LeetCode) fetch metadata from a same-origin API.
export async function parsePage(
  doc: Document,
  href: string
): Promise<CapturePayload | null> {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const parser = PARSERS.find((p) => p.matches(url));
  return parser ? await parser.parse(doc, url) : null;
}
