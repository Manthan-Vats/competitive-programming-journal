import React from "react";
import { Language } from "@/types";
import { CopyButton } from "./copy-button";

interface CodeViewerProps {
  code: string;
  language: Language;
  label?: string;
}

/**
 * CodeViewer / CodeInsert - the accepted code copied onto a graph-paper sheet
 * (00_FOUNDATIONS §3): red left margin rule, mono line numbers (the `.cpj-code`
 * counter in globals.css), warm ink on graph paper, a blueprint copy chip.
 *
 * Intentionally monochrome: ink-on-graph-paper reads like a hand-copied ledger
 * entry, which is more on-theme than IDE syntax colours - and it keeps this a
 * plain sync component (no Shiki/WASM in the server render path, which was
 * crashing the worker). Admin detail + revision render code the same way, so
 * code looks identical everywhere.
 */
export function CodeViewer({ code, language, label }: CodeViewerProps) {
  if (!code) {
    return (
      <div className="w-full cpj-graph cpj-card-shadow text-ink-faint p-4 rounded-[3px] text-center font-body text-[14px]">
        no code on file
      </div>
    );
  }

  const lines = code.replace(/\n+$/, "").split("\n");

  return (
    <div className="relative w-full cpj-graph cpj-card-shadow rounded-[3px] overflow-hidden">
      {/* red margin rule */}
      <div className="absolute left-[38px] top-0 bottom-0 w-px bg-margin-red pointer-events-none" aria-hidden />

      {/* header: language + label + copy chip */}
      <div className="relative flex items-center justify-between px-4 pt-2.5 pb-1">
        <span className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
          {language}
        </span>
        <div className="flex items-center gap-2">
          {label && (
            <span className="font-body text-[12px] text-ink-soft truncate max-w-[200px]">{label}</span>
          )}
          <CopyButton code={code} />
        </div>
      </div>

      {/* code - numbered ledger lines */}
      <pre className="cpj-code relative px-4 pb-3.5 pl-[14px] overflow-x-auto text-[13px] font-mono leading-[1.65] text-ink">
        <code>
          {lines.map((ln, i) => (
            <span key={i} className="line">
              {ln || " "}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
