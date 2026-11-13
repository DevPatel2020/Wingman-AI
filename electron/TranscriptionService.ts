// TranscriptionService.ts
// Speech-to-text for live transcription. Two interchangeable backends:
//   - "whisper": a local Whisper server (faster-whisper / speaches / whisper.cpp)
//                exposing an OpenAI-compatible POST /v1/audio/transcriptions
//                endpoint. Audio never leaves the machine.
//   - "gemini":  Google Gemini multimodal model (cloud).
// Selected with TRANSCRIPTION_PROVIDER, defaulting to whisper when WHISPER_URL is set.

import { envString, loadEnv } from "./env"
import { LLMHelper } from "./LLMHelper"

export type TranscriptionBackend = "whisper" | "gemini"

/** Phrases speech models commonly hallucinate on silence or background noise. */
const HALLUCINATION_PATTERNS: RegExp[] = [
  /^\s*[\[(]?\s*(blank[_ ]audio|silence|no speech|music|inaudible|noise)\s*[\])]?\s*\.?\s*$/i,
  /^\s*(thank you|thanks)( (so much|very much))?( for watching)?[.!]?\s*$/i,
  /^\s*(you|bye)[.!]?\s*$/i,
  /^\s*[.…\s-]*$/ // only punctuation / ellipsis
]

export function isLikelyHallucination(text: string): boolean {
  return HALLUCINATION_PATTERNS.some((re) => re.test(text))
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm"
  if (mimeType.includes("ogg")) return "ogg"
  if (mimeType.includes("wav")) return "wav"
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a"
  return "webm"
}

export class TranscriptionService {
  constructor(private readonly getLlm: () => LLMHelper) {}

  public getBackend(): TranscriptionBackend {
    loadEnv()
    const explicit = envString("TRANSCRIPTION_PROVIDER")?.toLowerCase()
    if (explicit === "whisper" || explicit === "gemini") return explicit
    return envString("WHISPER_URL") ? "whisper" : "gemini"
  }

  public describeBackend(): string {
    return this.getBackend() === "whisper"
      ? `Local Whisper (${this.whisperUrl()})`
      : "Google Gemini (cloud)"
  }

  /** Returns cleaned transcript text, or "" when the clip has no usable speech. */
  public async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    const raw =
      this.getBackend() === "whisper"
        ? await this.transcribeWithWhisper(audio, mimeType)
        : await this.getLlm().transcribeAudio(audio.toString("base64"), mimeType)

    const text = raw.replace(/\s+/g, " ").trim()
    if (!text || isLikelyHallucination(text)) return ""
    return text
  }

  private whisperUrl(): string {
    return envString("WHISPER_URL") || "http://localhost:8000/v1/audio/transcriptions"
  }

  private async transcribeWithWhisper(audio: Buffer, mimeType: string): Promise<string> {
    const form = new FormData()
    const blob = new Blob([new Uint8Array(audio)], { type: mimeType })
    form.append("file", blob, `chunk.${extensionFor(mimeType)}`)
    form.append("model", envString("WHISPER_MODEL") || "Systran/faster-whisper-small")
    form.append("response_format", "json")
    const language = envString("WHISPER_LANGUAGE")
    if (language) form.append("language", language)

    let response: Response
    try {
      response = await fetch(this.whisperUrl(), { method: "POST", body: form })
    } catch (error: any) {
      throw new Error(
        `Could not reach the Whisper server at ${this.whisperUrl()}. Is it running? (${error?.message ?? error})`
      )
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`Whisper server error ${response.status}: ${body.slice(0, 200)}`)
    }
    const data: any = await response.json()
    return typeof data?.text === "string" ? data.text : ""
  }
}
