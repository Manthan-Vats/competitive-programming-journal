import Link from "next/link";
import { ModifiedBear } from "@/components/modified-bear";
import { PaperSheet } from "@/components/paper/paper-sheet";

/**
 * 404 - "What the hell am I doing here?" (Creep). A torn sheet on the desk.
 */
export default function NotFound() {
  return (
    <div className="cpj-desk min-h-screen w-full flex items-center justify-center p-6">
      <PaperSheet variant="page" className="cpj-develop w-full max-w-[380px] p-8 text-center">
        <div className="flex items-center justify-center gap-3 select-none">
          <span className="font-display text-[80px] leading-none text-ink">4</span>
          <ModifiedBear className="w-16 h-16 text-blood" />
          <span className="font-display text-[80px] leading-none text-ink">4</span>
        </div>
        <p className="font-type text-[18px] text-ink mt-3">what the hell am i doing here?</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint mt-2">
          this page doesn&apos;t belong here
        </p>
        <Link
          href="/"
          className="inline-flex items-center mt-6 font-type text-[14px] text-ink border border-ink rounded-[2px] px-4 py-2 hover:bg-ink/5 transition-colors"
        >
          ▸ i don&apos;t belong here
        </Link>
      </PaperSheet>
    </div>
  );
}
