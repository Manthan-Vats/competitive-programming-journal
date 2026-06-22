// Local-timezone date helpers.
// The activity heatmap + streak stats must bucket timestamps by the user's LOCAL calendar
// day, and every consumer must agree on the key format. The previous code mixed UTC
// (`timestamp.split("T")[0]` and `Date.toISOString()`) with locally-constructed Date
// objects, which shifted the whole calendar by a day for users behind/ahead of UTC
// (e.g. IST, UTC+5:30). These helpers give one consistent LOCAL "YYYY-MM-DD" key.

export function localDateKey(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// The journal's effective date for a problem: the real solve time when known, else the
// row-insert time. Accepts the raw problem-ish object.
export function problemDate(p: { solved_at?: string | null; created_at: string }): string {
  return p.solved_at || p.created_at;
}
