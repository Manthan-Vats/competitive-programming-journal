"use client";

import React from "react";
import { Download, ExternalLink, Puzzle } from "lucide-react";
import { Cap } from "@/components/paper/bits";

// "Get the browser companion" block for Settings. The extension is distributed as an unpacked
// build via GitHub Releases (no paid web-store account), so we link the latest release + give the
// quick load-unpacked steps.
const RELEASES_URL =
  "https://github.com/Manthan-Vats/competitive-programming-journal/releases/latest";

export const ExtensionInstall: React.FC = () => {
  return (
    <div className="bg-paper border border-paper-edge rounded-[3px] cpj-card-shadow p-4">
      <div className="flex items-start gap-3">
        <Puzzle className="w-5 h-5 text-blood shrink-0 mt-0.5" />
        <div className="min-w-0">
          <Cap>BROWSER COMPANION</Cap>
          <p className="font-body text-[14px] leading-[1.55] text-ink-soft mt-1">
            Capture a problem in one click straight from Codeforces, LeetCode, AtCoder, or CodeChef -
            plus a solve timer and one-click solution attach. Free; installs in about a minute.
          </p>

          <ol className="font-body text-[13px] leading-[1.7] text-ink-soft mt-3 list-decimal pl-5 space-y-0.5">
            <li>Download the zip below and unzip it.</li>
            <li>
              Open <code className="font-mono text-[12px]">chrome://extensions</code> (or{" "}
              <code className="font-mono text-[12px]">edge://extensions</code>) and turn on{" "}
              <strong>Developer mode</strong>.
            </li>
            <li>Click <strong>Load unpacked</strong> and pick the unzipped folder.</li>
            <li>Click the bear icon, then <strong>Connect</strong> (while logged in here).</li>
          </ol>

          <div className="flex flex-wrap items-center gap-3 mt-3.5">
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[12px] text-paper bg-blood px-3 py-2 rounded-[3px] hover:opacity-90 transition-opacity"
            >
              <Download className="w-[14px] h-[14px]" /> download the companion
            </a>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-blueprint hover:underline"
            >
              all releases <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionInstall;
