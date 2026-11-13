import { describe, expect, it } from "vitest"
import { isDue, newSrsState, review } from "../electron/srs"

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 0, 1)

describe("SM-2 scheduling", () => {
  it("new cards are due immediately", () => {
    expect(isDue(newSrsState(now), now)).toBe(true)
  })

  it("follows the 1 day -> 6 days -> interval * ease progression on 'good'", () => {
    let s = newSrsState(now)
    s = review(s, "good", now)
    expect(s.interval).toBe(1)
    expect(s.due).toBe(now + DAY)
    s = review(s, "good", now)
    expect(s.interval).toBe(6)
    s = review(s, "good", now)
    expect(s.interval).toBe(Math.round(6 * s.ease))
  })

  it("'again' resets the streak, counts a lapse and lowers ease", () => {
    let s = review(review(newSrsState(now), "good", now), "good", now)
    const before = s.ease
    s = review(s, "again", now)
    expect(s.reps).toBe(0)
    expect(s.lapses).toBe(1)
    expect(s.ease).toBeLessThan(before)
    expect(s.due - now).toBe(10 * 60 * 1000)
  })

  it("never lets ease fall below 1.3", () => {
    let s = newSrsState(now)
    for (let i = 0; i < 20; i++) s = review(s, "again", now)
    expect(s.ease).toBe(1.3)
  })

  it("'easy' schedules further out than 'good'", () => {
    const base = review(review(newSrsState(now), "good", now), "good", now)
    expect(review(base, "easy", now).interval).toBeGreaterThan(review(base, "good", now).interval)
  })
})
