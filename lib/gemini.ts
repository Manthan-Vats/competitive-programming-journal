// Back-compat shim. The AI code-analysis logic moved to the provider-agnostic layer in
// `lib/ai/` (Gemini primary + optional Groq fallback). This file is kept so existing imports of
// `@/lib/gemini` keep working; new code should import from `@/lib/ai/analyze-code`.
export { analyzeCode, CPAnalysisSchema, type CPAnalysisType } from "@/lib/ai/analyze-code";
