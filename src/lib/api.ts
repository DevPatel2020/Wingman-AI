// api.ts
// Typed wrappers around the IPC channels for memory, study and practice.

export interface SessionInfo {
  id: string
  title: string
  startedAt: number
  endedAt?: number
  segmentCount: number
  hasNotes: boolean
  inMemory: boolean
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

export interface MemoryStats {
  chunks: number
  sessions: number
  embedded: number
  embeddingModel: string
}

export interface DeckSummary {
  id: string
  title: string
  createdAt: number
  cardCount: number
  dueCount: number
  quizCount: number
  bestQuiz?: number
}

export interface Flashcard {
  id: string
  front: string
  back: string
  srs: { ease: number; interval: number; reps: number; due: number; lapses: number }
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  answerIndex: number
  explanation: string
}

export interface Deck {
  id: string
  title: string
  cards: Flashcard[]
  quiz: QuizQuestion[]
}

export type Grade = "again" | "hard" | "good" | "easy"
export type PracticeTrack = "behavioral" | "technical" | "system-design" | "presentation"

export interface PracticeAttempt {
  id: string
  at: number
  track: PracticeTrack
  role: string
  question: string
  answer: string
  feedback: {
    score: number
    summary: string
    strengths: string[]
    improvements: string[]
    star?: { situation: boolean; task: boolean; action: boolean; result: boolean }
    sampleAnswer: string
  }
}

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  window.electronAPI.invoke(channel, ...args) as Promise<T>

/** Strips Electron's "Error invoking remote method 'x': Error:" prefix. */
export function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, "")
}

export const api = {
  sessions: {
    list: () => invoke<SessionInfo[]>("sessions:list"),
    delete: (id: string) => invoke<{ success: boolean }>("sessions:delete", id)
  },
  followUp: (sessionId: string) => invoke<string>("transcript:followup", sessionId),
  memory: {
    ask: (q: string) => invoke<MemoryAnswer>("memory:ask", q),
    stats: () => invoke<MemoryStats>("memory:stats"),
    reindexAll: () => invoke<{ sessions: number; chunks: number; warnings: string[] }>("memory:reindex-all")
  },
  study: {
    list: () => invoke<DeckSummary[]>("study:list"),
    fromSession: (sessionId: string) => invoke<DeckSummary>("study:create-from-session", sessionId),
    fromText: (title: string, text: string) => invoke<DeckSummary>("study:create-from-text", title, text),
    get: (deckId: string) => invoke<Deck>("study:get", deckId),
    due: (deckId: string) => invoke<Flashcard[]>("study:due", deckId),
    review: (deckId: string, cardId: string, grade: Grade) => invoke<Flashcard>("study:review", deckId, cardId, grade),
    recordQuiz: (deckId: string, score: number, total: number) => invoke<void>("study:record-quiz", deckId, score, total),
    delete: (deckId: string) => invoke<void>("study:delete", deckId)
  },
  practice: {
    question: (track: PracticeTrack, role: string) => invoke<string>("practice:question", track, role),
    evaluate: (opts: { track: PracticeTrack; role: string; question: string; answer: string }) =>
      invoke<PracticeAttempt>("practice:evaluate", opts),
    history: () =>
      invoke<{ history: PracticeAttempt[]; stats: { attempts: number; average: number | null; recentAverage: number | null } }>(
        "practice:history"
      )
  },
  transcribeOnce: (data: string, mimeType: string) => invoke<string>("stt:transcribe", data, mimeType)
}
