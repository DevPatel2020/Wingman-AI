// StudyStore.ts
// Study mode: turns a lecture/meeting transcript (or pasted notes) into
// flashcards + a multiple-choice quiz, and schedules reviews with SM-2.

import { app } from "electron"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { LLMHelper } from "./LLMHelper"
import { extractJson } from "./ragCore"
import { Grade, SrsState, isDue, newSrsState, review } from "./srs"

export interface Flashcard {
  id: string
  front: string
  back: string
  srs: SrsState
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
  createdAt: number
  sourceSessionId?: string
  cards: Flashcard[]
  quiz: QuizQuestion[]
  quizHistory: Array<{ at: number; score: number; total: number }>
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

const MAX_SOURCE_CHARS = 30_000

export class StudyStore {
  private decks: Deck[] | null = null

  constructor(private readonly getLlm: () => LLMHelper) {}

  private get file(): string {
    const dir = path.join(app.getPath("userData"), "study")
    fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, "decks.json")
  }

  private load(): Deck[] {
    if (this.decks) return this.decks
    try {
      this.decks = JSON.parse(fs.readFileSync(this.file, "utf-8")) as Deck[]
    } catch {
      this.decks = []
    }
    return this.decks
  }

  private save(): void {
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.load(), null, 2), "utf-8")
    fs.renameSync(tmp, this.file)
  }

  public list(now = Date.now()): DeckSummary[] {
    return this.load()
      .map((d) => ({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt,
        cardCount: d.cards.length,
        dueCount: d.cards.filter((c) => isDue(c.srs, now)).length,
        quizCount: d.quiz.length,
        bestQuiz: d.quizHistory.length
          ? Math.max(...d.quizHistory.map((h) => Math.round((100 * h.score) / h.total)))
          : undefined
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  public get(deckId: string): Deck {
    const deck = this.load().find((d) => d.id === deckId)
    if (!deck) throw new Error("Deck not found")
    return deck
  }

  public dueCards(deckId: string, now = Date.now()): Flashcard[] {
    return this.get(deckId)
      .cards.filter((c) => isDue(c.srs, now))
      .sort((a, b) => a.srs.due - b.srs.due)
  }

  public async createDeck(opts: { title: string; source: string; sourceSessionId?: string }): Promise<DeckSummary> {
    const source = opts.source.trim()
    if (source.length < 80) throw new Error("Not enough material to study. Record a longer session or paste more notes.")
    const prompt = `You are a study assistant creating revision material from lecture or meeting content.
Create:
- 8 to 15 flashcards that test the most important concepts, definitions, facts and reasoning (not trivia).
- 5 multiple-choice quiz questions, each with exactly 4 options and one correct answer.
Base everything ONLY on the material below. Keep card fronts short; backs should be 1-3 sentences.

Return ONLY JSON in this exact shape:
{"cards":[{"front":"...","back":"..."}],"quiz":[{"question":"...","options":["a","b","c","d"],"answerIndex":0,"explanation":"..."}]}

Material:
${source.slice(0, MAX_SOURCE_CHARS)}`

    const raw = await this.getLlm().complete(prompt)
    const parsed = extractJson<{ cards?: any[]; quiz?: any[] }>(raw)
    const now = Date.now()
    const cards: Flashcard[] = (parsed.cards ?? [])
      .filter((c) => typeof c?.front === "string" && typeof c?.back === "string")
      .map((c) => ({ id: crypto.randomUUID(), front: c.front.trim(), back: c.back.trim(), srs: newSrsState(now) }))
    const quiz: QuizQuestion[] = (parsed.quiz ?? [])
      .filter(
        (q) =>
          typeof q?.question === "string" &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          Number.isInteger(q.answerIndex) &&
          q.answerIndex >= 0 &&
          q.answerIndex < q.options.length
      )
      .map((q) => ({
        id: crypto.randomUUID(),
        question: q.question.trim(),
        options: q.options.map((o: unknown) => String(o)),
        answerIndex: q.answerIndex,
        explanation: String(q.explanation ?? "")
      }))
    if (cards.length === 0) throw new Error("The AI didn't return any usable flashcards. Try again.")

    const deck: Deck = {
      id: crypto.randomUUID(),
      title: opts.title.trim() || "Study deck",
      createdAt: now,
      sourceSessionId: opts.sourceSessionId,
      cards,
      quiz,
      quizHistory: []
    }
    this.load().push(deck)
    this.save()
    return this.list().find((d) => d.id === deck.id)!
  }

  public reviewCard(deckId: string, cardId: string, grade: Grade): Flashcard {
    const card = this.get(deckId).cards.find((c) => c.id === cardId)
    if (!card) throw new Error("Card not found")
    card.srs = review(card.srs, grade)
    this.save()
    return card
  }

  public recordQuiz(deckId: string, score: number, total: number): void {
    this.get(deckId).quizHistory.push({ at: Date.now(), score, total })
    this.save()
  }

  public delete(deckId: string): void {
    this.decks = this.load().filter((d) => d.id !== deckId)
    this.save()
  }
}
