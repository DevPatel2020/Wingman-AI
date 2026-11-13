// srs.ts
// SM-2 spaced-repetition scheduling (the algorithm behind SuperMemo / Anki).
// Pure functions so the schedule can be unit tested.

export interface SrsState {
  /** Ease factor, >= 1.3 */
  ease: number
  /** Current interval in days */
  interval: number
  /** Consecutive successful reviews */
  reps: number
  /** Epoch ms when the card is next due */
  due: number
  lapses: number
}

/** Grades shown in the UI */
export type Grade = "again" | "hard" | "good" | "easy"

const GRADE_TO_QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 }
const DAY_MS = 24 * 60 * 60 * 1000

export function newSrsState(now = Date.now()): SrsState {
  return { ease: 2.5, interval: 0, reps: 0, due: now, lapses: 0 }
}

export function review(state: SrsState, grade: Grade, now = Date.now()): SrsState {
  const q = GRADE_TO_QUALITY[grade]
  // SM-2 ease update: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const ease = Math.max(1.3, state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))

  if (q < 3) {
    // Lapse: relearn soon (10 minutes), reset the streak.
    return { ease, interval: 0, reps: 0, due: now + 10 * 60 * 1000, lapses: state.lapses + 1 }
  }

  const reps = state.reps + 1
  let interval: number
  if (reps === 1) interval = 1
  else if (reps === 2) interval = 6
  else interval = Math.round(state.interval * ease)
  if (grade === "hard") interval = Math.max(1, Math.round(interval * 0.8))
  if (grade === "easy") interval = Math.round(interval * 1.3)

  return { ease, interval, reps, due: now + interval * DAY_MS, lapses: state.lapses }
}

export function isDue(state: SrsState, now = Date.now()): boolean {
  return state.due <= now
}
