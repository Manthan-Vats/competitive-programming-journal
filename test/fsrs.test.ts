import { newCard, gradeCard, previewDueDates, isGrade, RATING_BY_NAME, Rating, State } from "../lib/fsrs";

// Unit tests for the ts-fsrs wrapper (P4). Run: npx tsx test/fsrs.test.ts
// Verifies serialization (dates -> ISO), a fresh card, grading, the stored-card round-trip, and
// the relative ordering of the four grades' next-due dates.

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}

const NOW = new Date("2026-06-01T00:00:00.000Z");

// Rating map matches ts-fsrs enum.
check("rating again=1", RATING_BY_NAME.again === Rating.Again && Rating.Again === 1);
check("rating easy=4", RATING_BY_NAME.easy === Rating.Easy && Rating.Easy === 4);

check("isGrade 1..4 true", [1, 2, 3, 4].every(isGrade));
check("isGrade 0 (Manual) false", !isGrade(0));
check("isGrade 5 false", !isGrade(5));
check("isGrade string false", !isGrade("good"));

// Fresh card.
const c0 = newCard(NOW);
check("new card state = New(0)", c0.state === State.New && c0.state === 0, c0.state);
check("new card reps 0", c0.reps === 0);
check("new card lapses 0", c0.lapses === 0);
check("new card due is ISO string", typeof c0.due === "string" && !Number.isNaN(Date.parse(c0.due)), c0.due);
check("new card last_review null", c0.last_review === null);

// Grade Good -> reps increments, leaves New, due moves into the future, stays serialized.
const { card: c1 } = gradeCard(c0, Rating.Good, NOW);
check("graded reps 1", c1.reps === 1, c1.reps);
check("graded left New", c1.state !== State.New, c1.state);
check("graded due is string", typeof c1.due === "string");
check("graded last_review is string (not null)", typeof c1.last_review === "string", c1.last_review);
check("graded due in the future", new Date(c1.due).getTime() > NOW.getTime(), c1.due);

// Round-trip: the stored card feeds straight back into the scheduler.
const later = new Date(c1.due);
const { card: c2 } = gradeCard(c1, Rating.Good, later);
check("round-trip reps 2", c2.reps === 2, c2.reps);

// Again should schedule sooner than Good, which is sooner than Easy.
const due = previewDueDates(c0, NOW);
check("preview has 4 grades", ["again", "hard", "good", "easy"].every((k) => typeof (due as Record<string, string>)[k] === "string"));
const t = (s: string) => new Date(s).getTime();
check("again <= good", t(due.again) <= t(due.good), due);
check("good <= easy", t(due.good) <= t(due.easy), due);

console.log(`\nALL PASS (${passed} checks)`);
