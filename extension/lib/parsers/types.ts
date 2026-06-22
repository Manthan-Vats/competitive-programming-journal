import type { CapturePayload } from "../messages";

// A judge parser reads the CURRENT problem page (live document + URL) and returns a
// capture payload, or null if the page isn't a recognizable problem. Each parser owns
// its own URL matching so the registry can pick the right one.
// S2 v1 is intentionally lean (url / title / platform_id - always reliably present).
// Rating + tags enrichment (e.g. via the Codeforces API) is layered on in a later slice.
export interface JudgeParser {
  readonly platform: string;
  /** True if this parser handles the given problem URL. */
  matches(url: URL): boolean;
  /**
   * Parse the live page. `doc` and `url` are passed in for testability. May be async -
   * some judges (e.g. LeetCode) fetch metadata from a same-origin API.
   */
  parse(
    doc: Document,
    url: URL
  ): CapturePayload | null | Promise<CapturePayload | null>;
}
