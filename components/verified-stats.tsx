import React from "react";
import { BadgeCheck } from "lucide-react";
import { badgeMessage, type VerifyPlatform, type VerifyStats } from "@/lib/verify";
import { Cap } from "@/components/paper/bits";

export interface PublicVerification {
  platform: string;
  handle: string;
  stats: VerifyStats;
  verified_at: string | null;
  source: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  codeforces: "Codeforces",
  leetcode: "LeetCode",
  github: "GitHub",
};

function profileUrl(platform: string, handle: string): string {
  if (platform === "codeforces") return `https://codeforces.com/profile/${handle}`;
  if (platform === "leetcode") return `https://leetcode.com/u/${handle}`;
  if (platform === "github") return `https://github.com/${handle}`;
  return "#";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function VerifiedStats({
  verifications,
  patterns,
}: {
  verifications: PublicVerification[];
  patterns: { pattern: string; count: number }[];
}) {
  if (verifications.length === 0 && patterns.length === 0) return null;

  return (
    <section className="mt-10 space-y-7">
      {verifications.length > 0 && (
        <div className="space-y-3">
          <Cap>ON RECORD · VERIFIED</Cap>
          <p className="font-body italic text-[13px] text-ink-soft -mt-1 max-w-prose">
            Each handle below was proven owned (a one-time token placed in that account&apos;s own
            profile) and the figures were pulled straight from the platform - never typed. Click a
            handle to check it against the source.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {verifications.map((v) => {
              const label = PLATFORM_LABEL[v.platform] ?? v.platform;
              const message =
                v.platform in PLATFORM_LABEL
                  ? badgeMessage(v.platform as VerifyPlatform, v.stats ?? {})
                  : "verified";
              return (
                <div
                  key={v.platform}
                  className="bg-paper-sheet cpj-card-shadow rounded-[3px] p-4 border-l-[3px] border-t-green space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4 text-t-green shrink-0" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</span>
                  </div>
                  <a
                    href={profileUrl(v.platform, v.handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-mono text-[13px] text-ink hover:text-blood truncate"
                  >
                    @{v.handle}
                  </a>
                  <p className="font-body text-[15px] text-ink">{message}</p>
                  <p className="font-mono text-[10px] text-ink-faint">
                    verified {fmtDate(v.verified_at)}
                    {v.source ? ` · ${v.source.split(":")[0]}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {patterns.length > 0 && (
        <div className="space-y-2.5">
          <Cap>PATTERNS · DEPTH</Cap>
          <p className="font-body italic text-[13px] text-ink-soft -mt-1">
            techniques this journal covers - depth, not just volume.
          </p>
          <div className="flex flex-wrap gap-2">
            {patterns.map((p) => (
              <span
                key={p.pattern}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-[2px] bg-[#dcd4bf] text-[#5b5640]"
              >
                {p.pattern}
                <span className="text-blood tabular-nums">{p.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
