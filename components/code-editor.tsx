"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Language } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Lazy-load Monaco Editor (prevent SSR issues)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full cpj-graph border border-paper-edge flex items-center justify-center text-ink-soft text-[13px] rounded-[3px] font-type">
      loading the editor...
    </div>
  ),
});

interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  language: Language;
  onLanguageChange?: (l: Language) => void;
  label?: string;
}

const MONACO_LANGS: Record<Language, string> = {
  cpp: "cpp",
  python: "python",
  java: "java",
  go: "go",
  rust: "rust",
  js: "javascript",
  other: "plaintext",
};

// File-upload allowlist (F7). We only accept plain-text SOURCE files: map known code
// extensions -> our Language enum. Anything else is rejected. The file is read as TEXT
// only (never executed) and stored as a string exactly like pasted code, so there's no
// new injection surface (code is rendered escaped). Size is capped to keep payloads sane.
const EXT_LANG: Record<string, Language> = {
  cpp: "cpp", cc: "cpp", cxx: "cpp", "c++": "cpp", c: "cpp", h: "cpp", hpp: "cpp", hh: "cpp",
  py: "python", pyw: "python",
  java: "java",
  go: "go",
  rs: "rust",
  js: "js", jsx: "js", ts: "js", tsx: "js", mjs: "js", cjs: "js",
  txt: "other", kt: "other", cs: "other", rb: "other", swift: "other", scala: "other",
  php: "other", sql: "other", sh: "other",
};
const MAX_CODE_BYTES = 256 * 1024; // 256 KB - generous for any single solution file

// Reject binary/non-text files masquerading as source (e.g. a renamed .exe -> .cpp). A real
// source file is printable UTF-8: no NUL bytes, and only a tiny fraction of control chars.
// Files are read as TEXT and never executed, so this is about data integrity ("the file is
// what it claims"), not RCE - there's no server-side file handling at all.
export function looksLikeSourceText(text: string): boolean {
  if (text.length === 0) return false;
  const sample = text.slice(0, 4096);
  let control = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0) return false; // NUL byte => binary, reject outright
    // allow tab(9), LF(10), CR(13); count other C0 controls + the UTF-8 replacement char
    if (c < 9 || (c > 13 && c < 32) || c === 0xfffd) control++;
  }
  return control / sample.length < 0.02;
}

// Paper-tinted Monaco theme so the editor matches the warm sheet instead of a
// stark white box. Palette mirrors the Shiki/CodeInsert paper syntax (§3).
function definePaperTheme(monaco: typeof import("monaco-editor")) {
  monaco.editor.defineTheme("cpj-paper", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "", foreground: "211e18" },
      { token: "comment", foreground: "8a8266", fontStyle: "italic" },
      { token: "keyword", foreground: "b81d24" },
      { token: "keyword.control", foreground: "b81d24" },
      { token: "type", foreground: "36545f" },
      { token: "type.identifier", foreground: "36545f" },
      { token: "namespace", foreground: "36545f" },
      { token: "string", foreground: "4c6b3a" },
      { token: "number", foreground: "9c7b14" },
      { token: "delimiter", foreground: "6b6450" },
      { token: "operator", foreground: "8f141a" },
    ],
    colors: {
      "editor.background": "#f4efe2",
      "editor.foreground": "#211e18",
      "editorLineNumber.foreground": "#b9b09a",
      "editorLineNumber.activeForeground": "#8f141a",
      "editorCursor.foreground": "#b81d24",
      "editor.selectionBackground": "#e7b53a66",
      "editor.lineHighlightBackground": "#ece5d3",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#d8d0bb",
      "editorIndentGuide.activeBackground1": "#cabf9f",
      "editorWhitespace.foreground": "#d8d0bb",
      "editorGutter.background": "#efe9d9",
    },
  });
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  onLanguageChange,
  label,
}) => {
  const monacoLang = MONACO_LANGS[language] || "plaintext";
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const mapped = EXT_LANG[ext];
    if (!mapped) {
      toast.error(`Unsupported file type ".${ext}" - upload a source-code file.`);
      return;
    }
    if (file.size > MAX_CODE_BYTES) {
      toast.error("File too large - solutions must be under 256 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!looksLikeSourceText(text)) {
        toast.error("That file doesn't look like source code (binary or non-text). Upload your actual solution file.");
        return;
      }
      onChange(text);
      if (onLanguageChange && ext !== "txt") onLanguageChange(mapped);
      toast.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsText(file); // TEXT only - never executed
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Control bar above editor */}
      <div className="flex items-center justify-between gap-2 bg-paper-sheet p-2 border border-paper-edge rounded-t-[3px] border-b-0">
        <span className="text-[12px] font-mono tracking-[0.1em] text-ink-soft pl-1 uppercase">
          {label || "solution code"}
        </span>

        <div className="flex items-center gap-2">
          {/* upload a solution file (alternative to pasting) */}
          <input
            ref={fileRef}
            type="file"
            accept=".cpp,.cc,.cxx,.c,.h,.hpp,.hh,.py,.pyw,.java,.go,.rs,.js,.jsx,.ts,.tsx,.mjs,.cjs,.txt,.kt,.cs,.rb,.swift,.scala,.php,.sql,.sh"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[2px] border border-paper-edge bg-[#E4DCC6] text-ink-soft hover:text-blood font-mono text-[11px] transition-colors"
            title="Upload a solution file from your computer"
          >
            <Upload className="w-3.5 h-3.5" /> upload file
          </button>

        {onLanguageChange && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-faint font-mono">lang:</span>
            <Select
              value={language}
              onValueChange={(val) => onLanguageChange(val as Language)}
            >
              <SelectTrigger className="w-[120px] h-7 bg-[#E4DCC6] border-paper-edge text-[12px] text-ink-soft font-mono py-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-paper-sheet border-paper-edge text-[12px] text-ink font-mono">
                <SelectItem value="cpp">C++</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="go">Go</SelectItem>
                <SelectItem value="rust">Rust</SelectItem>
                <SelectItem value="js">JavaScript</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        </div>
      </div>

      {/* Monaco Container */}
      <div className="relative border border-paper-edge rounded-b-[3px] overflow-hidden">
        {/* Floating badge */}
        <div className="absolute top-2 right-4 z-10 font-mono text-[10px] tracking-wider uppercase text-ink-faint bg-paper-sheet/90 px-2 py-0.5 rounded-[2px] border border-paper-edge pointer-events-none select-none">
          {language}
        </div>

        <MonacoEditor
          height="400px"
          language={monacoLang}
          value={value}
          onChange={(val) => onChange(val || "")}
          beforeMount={definePaperTheme}
          theme="cpj-paper"
          options={{
            fontSize: 14,
            fontFamily: "var(--font-mono)",
            minimap: { enabled: false },
            lineNumbers: "on",
            wordWrap: "off",
            automaticLayout: true,
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
};
