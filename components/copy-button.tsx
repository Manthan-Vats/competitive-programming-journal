"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";

/** CopyButton - the blueprint "⧉ copy" chip on a CodeInsert (00_FOUNDATIONS §3). */
export const CopyButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.16em] uppercase bg-blueprint text-[#e7f1f3] rounded-[2px] px-2 py-1 select-none cursor-pointer"
      title="copy code"
    >
      {copied ? (
        <>
          <Check className="w-[12px] h-[12px]" /> copied
        </>
      ) : (
        <>⧉ copy</>
      )}
    </button>
  );
};
export default CopyButton;
