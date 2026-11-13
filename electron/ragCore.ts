// ragCore.ts
// Pure retrieval building blocks (no Electron / network), so they can be unit
// tested and evaluated in isolation:
//   - transcript chunking with overlap
//   - tokenization + BM25 keyword ranking
//   - cosine similarity for embeddings
//   - Reciprocal Rank Fusion to merge keyword and semantic rankings

export interface TimedText {
  startMs: number
  endMs: number
  text: string
}

export interface TextChunk {
  startMs: number
  endMs: number
  text: string
}

export interface ChunkOptions {
  /** Close a chunk once it reaches this many words */
  maxWords?: number
  /** ...or spans this many milliseconds */
  maxSpanMs?: number
  /** Segments carried over into the next chunk for context continuity */
  overlapSegments?: number
}

/** Groups consecutive transcript segments into retrieval-sized chunks. */
export function chunkSegments(segments: TimedText[], opts: ChunkOptions = {}): TextChunk[] {
  const maxWords = opts.maxWords ?? 120
  const maxSpanMs = opts.maxSpanMs ?? 90_000
  const overlap = Math.max(0, opts.overlapSegments ?? 1)
  const sorted = [...segments].filter((s) => s.text.trim()).sort((a, b) => a.startMs - b.startMs)
  const chunks: TextChunk[] = []

  let i = 0
  while (i < sorted.length) {
    const group: TimedText[] = []
    let words = 0
    let j = i
    while (j < sorted.length) {
      const seg = sorted[j]
      const segWords = countWords(seg.text)
      const span = group.length ? seg.endMs - group[0].startMs : 0
      if (group.length && (words + segWords > maxWords || span > maxSpanMs)) break
      group.push(seg)
      words += segWords
      j++
    }
    chunks.push({
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
      text: group.map((s) => s.text.trim()).join(" ")
    })
    if (j >= sorted.length) break
    // Step forward, keeping `overlap` segments, but always make progress.
    i = Math.max(i + 1, j - overlap)
  }
  return chunks
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

const STOPWORDS = new Set(
  (
    "a an and are as at be but by did do does for from had has have he her his i if in into is it its " +
    "me my of on or our she so that the their them then there these they this to us was we were what " +
    "when where which who why will with you your about just can could would should also been than too very re ve ll"
  ).split(" ")
)

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem)
}

/** Tiny suffix stripper so "decide / decided / decides / deciding" share one term. */
function stem(token: string): string {
  if (token.length <= 4) return token
  for (const suffix of ["ingly", "edly", "ing", "ers", "ies", "ied", "ed", "es", "ly", "s", "e"]) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      return suffix === "ies" || suffix === "ied" ? token.slice(0, -3) + "y" : token.slice(0, -suffix.length)
    }
  }
  return token
}

/** Okapi BM25 over an in-memory corpus. */
export class BM25 {
  private docs: string[][]
  private df = new Map<string, number>()
  private avgLen: number

  constructor(texts: string[], private k1 = 1.5, private b = 0.75) {
    this.docs = texts.map(tokenize)
    for (const doc of this.docs) {
      for (const term of new Set(doc)) this.df.set(term, (this.df.get(term) ?? 0) + 1)
    }
    const total = this.docs.reduce((n, d) => n + d.length, 0)
    this.avgLen = this.docs.length ? total / this.docs.length : 0
  }

  /** Returns [docIndex, score] pairs with score > 0, best first. */
  public rank(query: string): Array<[number, number]> {
    const terms = [...new Set(tokenize(query))]
    const N = this.docs.length
    const scores: Array<[number, number]> = []
    this.docs.forEach((doc, idx) => {
      if (!doc.length) return
      const tf = new Map<string, number>()
      for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1)
      let score = 0
      for (const term of terms) {
        const f = tf.get(term)
        if (!f) continue
        const n = this.df.get(term) ?? 0
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
        score += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * doc.length) / this.avgLen)))
      }
      if (score > 0) scores.push([idx, score])
    })
    return scores.sort((a, b) => b[1] - a[1])
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return norm ? v.map((x) => x / norm) : v
}

/**
 * Reciprocal Rank Fusion: merges several ranked lists of ids without needing
 * their scores to be on the same scale. score(d) = Σ 1 / (k + rank_i(d)).
 */
export function reciprocalRankFusion(rankings: string[][], k = 60): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>()
  for (const ranking of rankings) {
    ranking.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)))
  }
  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score)
}

/** Extracts the first JSON object/array from an LLM reply (handles ``` fences and chatter). */
export function extractJson<T = unknown>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.search(/[[{]/)
    if (start === -1) throw new Error("The AI reply did not contain JSON.")
    const open = cleaned[start]
    const close = open === "{" ? "}" : "]"
    const end = cleaned.lastIndexOf(close)
    if (end <= start) throw new Error("The AI reply contained incomplete JSON.")
    return JSON.parse(cleaned.slice(start, end + 1)) as T
  }
}

export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
  const s = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}
