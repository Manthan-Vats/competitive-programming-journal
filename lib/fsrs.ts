import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type CardInput,
  type Grade,
  type ReviewLog,
} from "ts-fsrs";

// Thin wrapper around ts-fsrs (v5) for the revision pillar (P4). A card is persisted as JSON with
// ISO date strings; ts-fsrs's CardInput accepts string/number dates, so a stored card feeds
// straight back into the scheduler with no manual Date revival. DB-free + deterministic given an
// explicit clock -> unit-testable. Default FSRS parameters (ts-fsrs auto-tunes; good out of the box).

const scheduler = fsrs();

// The four user-facing grades (ts-fsrs Rating minus Manual). Wire value <-> name both ways.
export const RATING_BY_NAME = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const;

export type RatingName = keyof typeof RATING_BY_NAME;

export function isGrade(v: unknown): v is Grade {
  return (
    v === Rating.Again || v === Rating.Hard || v === Rating.Good || v === Rating.Easy
  );
}

// A card serialized for storage / JSON transport: the two Date fields become strings.
export type StoredCard = Omit<Card, "due" | "last_review"> & {
  due: string;
  last_review: string | null;
};

function serialize(card: Card): StoredCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

// A fresh, never-reviewed card (State.New, due immediately).
export function newCard(now: Date = new Date()): StoredCard {
  return serialize(createEmptyCard(now));
}

// Apply a grade to a stored card -> the next stored card + the FSRS review log.
export function gradeCard(
  stored: StoredCard,
  grade: Grade,
  now: Date = new Date()
): { card: StoredCard; log: ReviewLog } {
  // StoredCard satisfies CardInput (string dates + numeric state are accepted by ts-fsrs).
  const { card, log } = scheduler.next(stored as CardInput, now, grade);
  return { card: serialize(card), log };
}

// Preview the next due date for each of the four grades, without committing - for UI hints
// ("Good -> in 3 days"). Returns ISO due strings keyed by rating name.
export function previewDueDates(
  stored: StoredCard,
  now: Date = new Date()
): Record<RatingName, string> {
  const rec = scheduler.repeat(stored as CardInput, now);
  return {
    again: rec[Rating.Again].card.due.toISOString(),
    hard: rec[Rating.Hard].card.due.toISOString(),
    good: rec[Rating.Good].card.due.toISOString(),
    easy: rec[Rating.Easy].card.due.toISOString(),
  };
}

export { Rating, State };
