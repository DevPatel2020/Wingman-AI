import { describe, expect, it } from "vitest"
import {
  BM25,
  chunkSegments,
  cosineSimilarity,
  extractJson,
  formatOffset,
  normalize,
  reciprocalRankFusion,
  tokenize
} from "../electron/ragCore"

const seg = (startS: number, text: string) => ({ startMs: startS * 1000, endMs: (startS + 10) * 1000, text })

describe("chunkSegments", () => {
  it("groups segments until the word budget and keeps order", () => {
    const segments = [seg(20, "c ".repeat(50)), seg(0, "a ".repeat(50)), seg(10, "b ".repeat(50))]
    const chunks = chunkSegments(segments, { maxWords: 100, overlapSegments: 0 })
    expect(chunks).toHaveLength(2)
    expect(chunks[0].startMs).toBe(0)
    expect(chunks[0].text.startsWith("a")).toBe(true)
    expect(chunks[1].startMs).toBe(20_000)
  })

  it("overlaps one segment between chunks by default", () => {
    const segments = [0, 10, 20, 30].map((s) => seg(s, "word ".repeat(60)))
    const chunks = chunkSegments(segments, { maxWords: 120 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[1].startMs).toBe(chunks[0].endMs - 10_000) // last segment of chunk 0 starts chunk 1
  })

  it("splits on time span even when word count is low", () => {
    const segments = [seg(0, "short"), seg(200, "later")]
    expect(chunkSegments(segments, { maxSpanMs: 90_000, overlapSegments: 0 })).toHaveLength(2)
  })

  it("always terminates with a single oversized segment", () => {
    expect(chunkSegments([seg(0, "x ".repeat(500))], { maxWords: 10 })).toHaveLength(1)
  })

  it("ignores empty segments", () => {
    expect(chunkSegments([seg(0, "   ")])).toEqual([])
  })
})

describe("tokenize", () => {
  it("lowercases, drops stopwords/punctuation and stems simple suffixes", () => {
    expect(tokenize("We DECIDED the deadline, and we're deciding!")).toEqual(["decid", "deadlin", "decid"])
  })
})

describe("BM25", () => {
  it("ranks the document with the query terms first", () => {
    const bm = new BM25([
      "we talked about lunch plans",
      "the database migration is scheduled for friday",
      "migration of the frontend happens later"
    ])
    const ranked = bm.rank("when is the database migration")
    expect(ranked[0][0]).toBe(1)
    expect(ranked.every(([, s]) => s > 0)).toBe(true)
  })

  it("returns nothing for a query with no matching terms", () => {
    expect(new BM25(["alpha beta"]).rank("gamma")).toEqual([])
  })
})

describe("vectors", () => {
  it("cosine similarity of identical, orthogonal and mismatched vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })

  it("normalize produces unit length", () => {
    const v = normalize([3, 4])
    expect(Math.hypot(...v)).toBeCloseTo(1)
  })
})

describe("reciprocalRankFusion", () => {
  it("rewards items ranked well in both lists", () => {
    const fused = reciprocalRankFusion([
      ["a", "b", "c"],
      ["b", "c", "a"]
    ])
    expect(fused[0].id).toBe("b")
    expect(fused.map((f) => f.id).sort()).toEqual(["a", "b", "c"])
  })
})

describe("extractJson", () => {
  it("parses fenced JSON and JSON surrounded by chatter", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Sure! Here you go: {"cards":[{"front":"x"}]} Hope it helps')).toEqual({
      cards: [{ front: "x" }]
    })
  })

  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow()
  })
})

describe("formatOffset", () => {
  it("formats minutes and hours", () => {
    expect(formatOffset(65_000)).toBe("01:05")
    expect(formatOffset(3_725_000)).toBe("1:02:05")
  })
})
