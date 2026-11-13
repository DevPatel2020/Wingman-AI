// MemoryStore.ts
// "Meeting memory": a retrieval-augmented generation (RAG) index over every
// saved transcript and its AI notes.
//
//   index:  transcript -> overlapping time-window chunks (+ notes sections)
//           -> embeddings (Gemini / Ollama) -> JSON file in userData/memory
//   query:  BM25 keyword ranking  ┐
//           cosine semantic rank  ┴-> Reciprocal Rank Fusion -> top-k
//           -> LLM answers ONLY from those chunks, citing [n] -> UI shows
//              each citation as meeting title + timestamp.
//
// If embeddings are unavailable (no key, model not pulled, offline) the index
// still works in keyword-only mode, and missing vectors are filled in on the
// next re-index.

import { app } from "electron"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { EmbeddingService } from "./EmbeddingService"
import { LLMHelper } from "./LLMHelper"
import { TranscriptSession } from "./TranscriptStore"
import { BM25, chunkSegments, cosineSimilarity, formatOffset, reciprocalRankFusion } from "./ragCore"

export interface MemoryChunk {
  id: string
  sessionId: string
  title: string
  startedAt: number
  kind: "transcript" | "notes"
  startMs: number
  endMs: number
  text: string
  embedding?: number[]
  embeddingModel?: string
}

export interface MemoryCitation {
  n: number
  sessionId: string
  title: string
  startedAt: number
  kind: "transcript" | "notes"
  startMs: number
  endMs: number
  text: string
}

export interface MemoryAnswer {
  answer: string
  citations: MemoryCitation[]
  mode: "hybrid" | "keyword"
  warning?: string
}

interface IndexFile {
  version: 1
  chunks: MemoryChunk[]
}

const TOP_K = 6

export class MemoryStore {
  private chunks: MemoryChunk[] | null = null

  constructor(
    private readonly embeddings: EmbeddingService,
    private readonly getLlm: () => LLMHelper
  ) {}

  private get file(): string {
    const dir = path.join(app.getPath("userData"), "memory")
    fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, "index.json")
  }

  private load(): MemoryChunk[] {
    if (this.chunks) return this.chunks
    try {
      const data = JSON.parse(fs.readFileSync(this.file, "utf-8")) as IndexFile
      this.chunks = Array.isArray(data.chunks) ? data.chunks : []
    } catch {
      this.chunks = []
    }
    return this.chunks
  }

  private save(): void {
    const tmp = `${this.file}.tmp`
    const data: IndexFile = { version: 1, chunks: this.load() }
    fs.writeFileSync(tmp, JSON.stringify(data), "utf-8")
    fs.renameSync(tmp, this.file)
  }

  /** (Re)indexes one session. Returns a warning if embeddings could not be computed. */
  public async indexSession(session: TranscriptSession): Promise<{ chunks: number; warning?: string }> {
    const base = { sessionId: session.id, title: session.title, startedAt: session.startedAt }
    const fresh: MemoryChunk[] = chunkSegments(session.segments).map((c) => ({
      id: crypto.randomUUID(),
      ...base,
      kind: "transcript" as const,
      ...c
    }))
    if (session.summary) {
      for (const section of session.summary.split(/\n(?=##\s)/)) {
        if (section.trim().length < 20) continue
        fresh.push({ id: crypto.randomUUID(), ...base, kind: "notes", startMs: 0, endMs: 0, text: section.trim() })
      }
    }

    const warning = await this.embedChunks(fresh)
    const all = this.load().filter((c) => c.sessionId !== session.id)
    all.push(...fresh)
    this.chunks = all
    this.save()
    return { chunks: fresh.length, warning }
  }

  public removeSession(sessionId: string): void {
    this.chunks = this.load().filter((c) => c.sessionId !== sessionId)
    this.save()
  }

  public stats(): { chunks: number; sessions: number; embedded: number; embeddingModel: string } {
    const chunks = this.load()
    const model = this.embeddings.modelId()
    return {
      chunks: chunks.length,
      sessions: new Set(chunks.map((c) => c.sessionId)).size,
      embedded: chunks.filter((c) => c.embeddingModel === model).length,
      embeddingModel: model
    }
  }

  public indexedSessionIds(): Set<string> {
    return new Set(this.load().map((c) => c.sessionId))
  }

  /** Hybrid retrieval. Exposed separately from ask() for testing and the eval script. */
  public async search(query: string, k = TOP_K): Promise<{ hits: MemoryChunk[]; mode: "hybrid" | "keyword"; warning?: string }> {
    const chunks = this.load()
    if (chunks.length === 0) return { hits: [], mode: "keyword" }

    const bm25 = new BM25(chunks.map((c) => `${c.title} ${c.text}`))
    const keywordRanking = bm25.rank(query).slice(0, 50).map(([i]) => chunks[i].id)

    let semanticRanking: string[] = []
    let warning: string | undefined
    const model = this.embeddings.modelId()
    const embedded = chunks.filter((c) => c.embedding && c.embeddingModel === model)
    if (model !== "none" && embedded.length > 0) {
      try {
        const [q] = await this.embeddings.embed([query], "query")
        semanticRanking = embedded
          .map((c) => ({ id: c.id, score: cosineSimilarity(q, c.embedding!) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 50)
          .map((x) => x.id)
      } catch (error: any) {
        warning = `Semantic search unavailable, using keywords only: ${error?.message ?? error}`
      }
    } else if (model === "none") {
      warning = "No embedding provider configured, so this used keyword search only."
    } else if (embedded.length < chunks.length) {
      warning = "Some meetings aren't embedded with the current model yet. Click Re-index."
    }

    const fused = reciprocalRankFusion(
      semanticRanking.length ? [keywordRanking, semanticRanking] : [keywordRanking]
    )
    const byId = new Map(chunks.map((c) => [c.id, c]))
    return {
      hits: fused.slice(0, k).map((f) => byId.get(f.id)!).filter(Boolean),
      mode: semanticRanking.length ? "hybrid" : "keyword",
      warning
    }
  }

  public async ask(question: string): Promise<MemoryAnswer> {
    const { hits, mode, warning } = await this.search(question)
    if (hits.length === 0) {
      return {
        answer: "I couldn't find anything about that in your saved meetings.",
        citations: [],
        mode,
        warning
      }
    }
    const citations: MemoryCitation[] = hits.map((h, i) => ({
      n: i + 1,
      sessionId: h.sessionId,
      title: h.title,
      startedAt: h.startedAt,
      kind: h.kind,
      startMs: h.startMs,
      endMs: h.endMs,
      text: h.text
    }))
    const sources = citations
      .map((c) => {
        const when = new Date(c.startedAt).toLocaleDateString()
        const where = c.kind === "notes" ? "AI notes" : `${formatOffset(c.startMs)}–${formatOffset(c.endMs)}`
        return `[${c.n}] "${c.title}" (${when}, ${where}):\n${c.text}`
      })
      .join("\n\n")

    const prompt = `You answer questions about the user's past meetings and lectures using ONLY the numbered sources below.
Rules:
- Cite every claim with its source number in square brackets, like [1] or [2][3].
- If the sources don't contain the answer, say so plainly. Do not guess or use outside knowledge.
- Be concise: a short paragraph or a few bullets.

Sources:
${sources}

Question: ${question}`

    const answer = await this.getLlm().complete(prompt)
    return { answer: answer.trim(), citations, mode, warning }
  }

  /** Fills in embeddings; on failure leaves chunks keyword-only and returns a warning. */
  private async embedChunks(chunks: MemoryChunk[]): Promise<string | undefined> {
    const model = this.embeddings.modelId()
    if (model === "none" || chunks.length === 0) {
      return model === "none" ? "No embedding provider configured, so meetings are indexed for keyword search only." : undefined
    }
    try {
      const vectors = await this.embeddings.embed(
        chunks.map((c) => `${c.title}\n${c.text}`),
        "document"
      )
      chunks.forEach((c, i) => {
        // Rounded to keep the JSON index compact; precision loss is negligible for cosine.
        c.embedding = vectors[i]?.map((x) => Math.round(x * 1e6) / 1e6)
        c.embeddingModel = model
      })
      return undefined
    } catch (error: any) {
      console.warn("[MemoryStore] Embedding failed, keyword-only:", error)
      return `Embeddings failed, so this meeting is indexed for keyword search only: ${error?.message ?? error}`
    }
  }
}
