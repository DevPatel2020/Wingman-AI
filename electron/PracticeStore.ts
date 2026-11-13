// PracticeStore.ts
// Mock-interview PRACTICE: the AI plays interviewer, the user answers (typed or
// spoken), and the AI gives structured, scored feedback. Attempts are saved so
// progress can be tracked over time. This is a preparation tool; it is meant
// to be used before an interview, never during one.

import { app } from "electron"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { LLMHelper } from "./LLMHelper"
import { extractJson } from "./ragCore"

export type PracticeTrack = "behavioral" | "technical" | "system-design" | "presentation"

export interface PracticeFeedback {
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  star?: { situation: boolean; task: boolean; action: boolean; result: boolean }
  sampleAnswer: string
}

export interface PracticeAttempt {
  id: string
  at: number
  track: PracticeTrack
  role: string
  question: string
  answer: string
  feedback: PracticeFeedback
}

const TRACK_BRIEF: Record<PracticeTrack, string> = {
  behavioral: "a behavioral question best answered with the STAR method (Situation, Task, Action, Result)",
  technical: "a conceptual technical question (fundamentals, trade-offs, debugging reasoning), answerable verbally in 2-3 minutes",
  "system-design": "a scoped system design question answerable verbally in 3-5 minutes",
  presentation: "a prompt to explain a concept or project clearly to a non-expert in about 2 minutes"
}

export class PracticeStore {
  private attempts: PracticeAttempt[] | null = null

  constructor(private readonly getLlm: () => LLMHelper) {}

  private get file(): string {
    const dir = path.join(app.getPath("userData"), "practice")
    fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, "history.json")
  }

  private load(): PracticeAttempt[] {
    if (this.attempts) return this.attempts
    try {
      this.attempts = JSON.parse(fs.readFileSync(this.file, "utf-8")) as PracticeAttempt[]
    } catch {
      this.attempts = []
    }
    return this.attempts
  }

  private save(): void {
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.load(), null, 2), "utf-8")
    fs.renameSync(tmp, this.file)
  }

  public history(limit = 20): PracticeAttempt[] {
    return [...this.load()].sort((a, b) => b.at - a.at).slice(0, limit)
  }

  public stats(): { attempts: number; average: number | null; recentAverage: number | null } {
    const all = this.load()
    const avg = (xs: PracticeAttempt[]) =>
      xs.length ? Math.round((10 * xs.reduce((s, a) => s + a.feedback.score, 0)) / xs.length) / 10 : null
    const recent = [...all].sort((a, b) => b.at - a.at).slice(0, 5)
    return { attempts: all.length, average: avg(all), recentAverage: avg(recent) }
  }

  public async nextQuestion(track: PracticeTrack, role: string): Promise<string> {
    const recent = this.history(15).map((a) => `- ${a.question}`).join("\n") || "(none)"
    const prompt = `You are an interviewer running a PRACTICE session for a candidate preparing for: ${role || "a software engineering role"}.
Ask exactly one new question: ${TRACK_BRIEF[track]}.
Avoid repeating or closely paraphrasing these recent questions:
${recent}
Return ONLY the question text, with no preamble.`
    const q = (await this.getLlm().complete(prompt)).trim().replace(/^["']|["']$/g, "")
    if (!q) throw new Error("The AI returned an empty question. Try again.")
    return q
  }

  public async evaluate(opts: { track: PracticeTrack; role: string; question: string; answer: string }): Promise<PracticeAttempt> {
    if (opts.answer.trim().length < 20) throw new Error("Give a fuller answer (at least a couple of sentences) to get feedback.")
    const starLine =
      opts.track === "behavioral"
        ? `"star": {"situation": bool, "task": bool, "action": bool, "result": bool},`
        : ""
    const prompt = `You are an encouraging but honest interview coach reviewing a PRACTICE answer.
Role: ${opts.role || "software engineering"}
Question type: ${TRACK_BRIEF[opts.track]}
Question: ${opts.question}
Candidate's answer (may be a speech transcript, so ignore filler words and transcription errors):
"""${opts.answer.slice(0, 8000)}"""

Score 1-10 on clarity, structure, depth and relevance. Return ONLY JSON:
{"score": number, "summary": "one or two sentences", "strengths": ["..."], "improvements": ["specific, actionable"], ${starLine} "sampleAnswer": "a concise model answer outline"}`

    const fb = extractJson<any>(await this.getLlm().complete(prompt))
    const feedback: PracticeFeedback = {
      score: Math.min(10, Math.max(1, Math.round(Number(fb.score) || 1))),
      summary: String(fb.summary ?? ""),
      strengths: Array.isArray(fb.strengths) ? fb.strengths.map(String) : [],
      improvements: Array.isArray(fb.improvements) ? fb.improvements.map(String) : [],
      star:
        opts.track === "behavioral" && fb.star
          ? {
              situation: !!fb.star.situation,
              task: !!fb.star.task,
              action: !!fb.star.action,
              result: !!fb.star.result
            }
          : undefined,
      sampleAnswer: String(fb.sampleAnswer ?? "")
    }
    const attempt: PracticeAttempt = { id: crypto.randomUUID(), at: Date.now(), ...opts, feedback }
    this.load().push(attempt)
    this.save()
    return attempt
  }
}
