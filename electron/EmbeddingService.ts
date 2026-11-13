// EmbeddingService.ts
// Text embeddings for semantic search. Providers:
//   - "ollama": local, e.g. nomic-embed-text (POST /api/embed)
//   - "gemini": Google gemini-embedding-001 via REST (768-dim, MRL-truncated)
//   - "none":   semantic search disabled; retrieval falls back to BM25 only
// Chosen with EMBEDDING_PROVIDER; by default follows the active LLM provider.

import { envString, loadEnv } from "./env"
import { LLMHelper } from "./LLMHelper"
import { normalize } from "./ragCore"

export type EmbeddingProvider = "ollama" | "gemini" | "none"
export type EmbeddingTask = "document" | "query"

const GEMINI_BATCH = 100
const GEMINI_DIMS = 768

export class EmbeddingService {
  constructor(private readonly getLlm: () => LLMHelper) {}

  public getProvider(): EmbeddingProvider {
    loadEnv()
    const explicit = envString("EMBEDDING_PROVIDER")?.toLowerCase()
    if (explicit === "ollama" || explicit === "gemini" || explicit === "none") return explicit
    const llm = this.getLlm()
    if (llm.isUsingOllama()) return "ollama"
    return llm.getGeminiApiKey() || envString("GEMINI_API_KEY") ? "gemini" : "none"
  }

  /** Stable id stored with each vector, so vectors from different models are never compared. */
  public modelId(): string {
    switch (this.getProvider()) {
      case "ollama":
        return `ollama:${this.ollamaModel()}`
      case "gemini":
        return `gemini:${this.geminiModel()}:${GEMINI_DIMS}`
      default:
        return "none"
    }
  }

  public async embed(texts: string[], task: EmbeddingTask): Promise<number[][]> {
    if (texts.length === 0) return []
    switch (this.getProvider()) {
      case "ollama":
        return this.embedOllama(texts)
      case "gemini":
        return this.embedGemini(texts, task)
      default:
        throw new Error("No embedding provider configured.")
    }
  }

  private ollamaModel(): string {
    return envString("OLLAMA_EMBED_MODEL") || "nomic-embed-text"
  }

  private geminiModel(): string {
    return envString("GEMINI_EMBED_MODEL") || "gemini-embedding-001"
  }

  private async embedOllama(texts: string[]): Promise<number[][]> {
    const url = this.getLlm().getOllamaUrl() || envString("OLLAMA_URL") || "http://localhost:11434"
    const res = await fetch(`${url}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.ollamaModel(), input: texts })
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(
        `Ollama embeddings failed (${res.status}). Run: ollama pull ${this.ollamaModel()}. ${body.slice(0, 120)}`
      )
    }
    const data: any = await res.json()
    return (data.embeddings as number[][]).map(normalize)
  }

  private async embedGemini(texts: string[], task: EmbeddingTask): Promise<number[][]> {
    const key = this.getLlm().getGeminiApiKey() || envString("GEMINI_API_KEY")
    if (!key) throw new Error("No Gemini API key for embeddings.")
    const model = this.geminiModel()
    const out: number[][] = []
    for (let i = 0; i < texts.length; i += GEMINI_BATCH) {
      const batch = texts.slice(i, i + GEMINI_BATCH)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
              taskType: task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
              outputDimensionality: GEMINI_DIMS
            }))
          })
        }
      )
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Gemini embeddings failed (${res.status}): ${body.slice(0, 160)}`)
      }
      const data: any = await res.json()
      // Truncated (Matryoshka) vectors must be re-normalized before cosine.
      for (const e of data.embeddings ?? []) out.push(normalize(e.values as number[]))
    }
    return out
  }
}
