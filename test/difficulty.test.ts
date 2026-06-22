import {
  PLATFORMS,
  DIFFICULTIES,
  SOLUTION_LANGUAGES,
  MAX_CODE_LENGTH,
  isPlatform,
  isDifficultyNorm,
  isLanguage,
  cfRatingToDifficulty,
  lcDifficultyToNorm,
} from "../lib/difficulty";

// Unit tests for the shared enum/difficulty module (single source of truth for the capture,
// import, manual-create, and metadata paths). Boundary correctness matters because this
// reconciled two previously-divergent Codeforces bucketings (1200/1800 vs 1300/1900).

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}

// --- CF rating -> difficulty (boundaries are exclusive upper bounds) ---
check("cf undefined -> unknown", cfRatingToDifficulty(undefined) === "unknown");
check("cf null -> unknown", cfRatingToDifficulty(null) === "unknown");
check("cf 0 -> unknown", cfRatingToDifficulty(0) === "unknown");
check("cf 800 -> easy", cfRatingToDifficulty(800) === "easy");
check("cf 1299 -> easy", cfRatingToDifficulty(1299) === "easy");
check("cf 1300 -> medium", cfRatingToDifficulty(1300) === "medium");
check("cf 1899 -> medium", cfRatingToDifficulty(1899) === "medium");
check("cf 1900 -> hard", cfRatingToDifficulty(1900) === "hard");
check("cf 2399 -> hard", cfRatingToDifficulty(2399) === "hard");
check("cf 2400 -> expert", cfRatingToDifficulty(2400) === "expert");
check("cf 3500 -> expert", cfRatingToDifficulty(3500) === "expert");

// --- LeetCode difficulty -> norm (case-insensitive) ---
check("lc Easy -> easy", lcDifficultyToNorm("Easy") === "easy");
check("lc MEDIUM -> medium", lcDifficultyToNorm("MEDIUM") === "medium");
check("lc hard -> hard", lcDifficultyToNorm("hard") === "hard");
check("lc unknown junk -> unknown", lcDifficultyToNorm("foo") === "unknown");
check("lc undefined -> unknown", lcDifficultyToNorm(undefined) === "unknown");

// --- allowlist guards ---
check("isPlatform codeforces", isPlatform("codeforces"));
check("isPlatform rejects junk", !isPlatform("myspace"));
check("isPlatform rejects non-string", !isPlatform(42));
check("isDifficultyNorm easy", isDifficultyNorm("easy"));
check("isDifficultyNorm rejects junk", !isDifficultyNorm("trivial"));
check("isLanguage cpp", isLanguage("cpp"));
check("isLanguage js", isLanguage("js"));
check("isLanguage rejects junk", !isLanguage("brainfuck"));
check("isLanguage rejects non-string", !isLanguage(null));

// --- set membership sanity (parity with types/index.ts) ---
check("PLATFORMS has all 9", PLATFORMS.size === 9, PLATFORMS.size);
check("DIFFICULTIES has 5", DIFFICULTIES.size === 5, DIFFICULTIES.size);
check("SOLUTION_LANGUAGES has 7", SOLUTION_LANGUAGES.size === 7, SOLUTION_LANGUAGES.size);
check("MAX_CODE_LENGTH is 100000", MAX_CODE_LENGTH === 100000, MAX_CODE_LENGTH);

console.log(`ALL PASS (${passed} assertions)`);
