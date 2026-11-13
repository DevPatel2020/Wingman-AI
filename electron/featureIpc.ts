// featureIpc.ts
// IPC for sessions library, meeting memory (RAG), study mode, interview
// practice, follow-up emails and one-shot speech-to-text.

import { ipcMain } from "electron"
import { AppState } from "./main"
import { formatLlmError } from "./llmErrors"
import { Grade } from "./srs"
import { PracticeTrack } from "./PracticeStore"

/** Wraps a handler so provider errors reach the UI as readable messages. */
function handle<A extends unknown[], R>(
  appState: AppState,
  channel: string,
  fn: (...args: A) => Promise<R> | R
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await fn(...(args as A))
    } catch (error: any) {
      console.error(`[ipc:${channel}]`, error)
      const provider = appState.processingHelper.getLLMHelper().getCurrentProvider()
      throw new Error(formatLlmError(error, provider))
    }
  })
}

export function initializeFeatureIpc(appState: AppState): void {
  const transcripts = appState.transcriptStore
  const memory = appState.memoryStore
  const study = appState.studyStore
  const practice = appState.practiceStore
  const llm = () => appState.processingHelper.getLLMHelper()

  // ─── Saved sessions ──────────────────────────────────────────────────────
  handle(appState, "sessions:list", () => {
    const indexed = memory.indexedSessionIds()
    return transcripts.listAll().map((s) => ({
      id: s.id,
      title: s.title,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      segmentCount: s.segments.length,
      hasNotes: !!s.summary,
      inMemory: indexed.has(s.id)
    }))
  })

  handle(appState, "sessions:delete", (sessionId: string) => {
    transcripts.delete(sessionId)
    memory.removeSession(sessionId)
    return { success: true }
  })

  // ─── Follow-up email ─────────────────────────────────────────────────────
  handle(appState, "transcript:followup", async (sessionId: string) => {
    const session = transcripts.get(sessionId)
    if (session.segments.length === 0) throw new Error("Nothing has been transcribed yet.")
    const context = session.summary
      ? `Meeting notes:\n${session.summary}`
      : `Transcript:\n${transcripts.toPlainText(session).slice(0, 20_000)}`
    return llm().complete(`Draft a short, professional follow-up email to the participants of the meeting "${session.title}".
Include: a one-line thank-you, a brief recap, decisions, and action items with owners if known.
Only use facts from the material below. Use [placeholders] for anything unknown, such as names.
Return the email with a "Subject:" line first, then the body. No extra commentary.

${context}`)
  })

  // ─── Meeting memory (RAG) ────────────────────────────────────────────────
  handle(appState, "memory:ask", (question: string) => {
    if (!question?.trim()) throw new Error("Type a question first.")
    return memory.ask(question.trim())
  })

  handle(appState, "memory:stats", () => memory.stats())

  handle(appState, "memory:reindex-all", async () => {
    const sessions = transcripts.listAll().filter((s) => s.segments.length > 0)
    const warnings = new Set<string>()
    let chunks = 0
    for (const s of sessions) {
      const r = await memory.indexSession(s)
      chunks += r.chunks
      if (r.warning) warnings.add(r.warning)
    }
    return { sessions: sessions.length, chunks, warnings: [...warnings] }
  })

  // ─── Study mode ──────────────────────────────────────────────────────────
  handle(appState, "study:list", () => study.list())

  handle(appState, "study:create-from-session", (sessionId: string) => {
    const s = transcripts.get(sessionId)
    const source = [s.summary ?? "", transcripts.toPlainText(s)].join("\n\n")
    return study.createDeck({ title: s.title, source, sourceSessionId: s.id })
  })

  handle(appState, "study:create-from-text", (title: string, text: string) =>
    study.createDeck({ title, source: text })
  )

  handle(appState, "study:get", (deckId: string) => study.get(deckId))
  handle(appState, "study:due", (deckId: string) => study.dueCards(deckId))
  handle(appState, "study:review", (deckId: string, cardId: string, grade: Grade) =>
    study.reviewCard(deckId, cardId, grade)
  )
  handle(appState, "study:record-quiz", (deckId: string, score: number, total: number) =>
    study.recordQuiz(deckId, score, total)
  )
  handle(appState, "study:delete", (deckId: string) => study.delete(deckId))

  // ─── Interview practice ──────────────────────────────────────────────────
  handle(appState, "practice:question", (track: PracticeTrack, role: string) =>
    practice.nextQuestion(track, role)
  )
  handle(
    appState,
    "practice:evaluate",
    (opts: { track: PracticeTrack; role: string; question: string; answer: string }) => practice.evaluate(opts)
  )
  handle(appState, "practice:history", () => ({ history: practice.history(), stats: practice.stats() }))

  // ─── One-shot speech-to-text (practice voice answers) ────────────────────
  handle(appState, "stt:transcribe", (data: string, mimeType: string) =>
    appState.transcriptionService.transcribe(Buffer.from(data, "base64"), mimeType)
  )
}
