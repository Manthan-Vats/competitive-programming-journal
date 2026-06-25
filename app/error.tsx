"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { PaperSheet } from "@/components/paper/paper-sheet";

// Route-level error boundary. Reports the error to Sentry and offers a retry. Themed like the 404.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="cpj-desk min-h-screen w-full flex items-center justify-center p-6">
      <PaperSheet variant="page" className="cpj-develop w-full max-w-[400px] p-8 text-center">
        <span className="font-display text-[64px] leading-none text-blood select-none">!</span>
        <p className="font-type text-[18px] text-ink mt-3">everything in its wrong place</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint mt-2">
          something came loose. it has been noted.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="inline-flex items-center font-type text-[14px] text-ink border border-ink rounded-[2px] px-4 py-2 hover:bg-ink/5 transition-colors cursor-pointer"
          >
            ▸ try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center font-type text-[14px] text-ink-soft hover:text-blood transition-colors"
          >
            the library
          </Link>
        </div>
      </PaperSheet>
    </div>
  );
}
