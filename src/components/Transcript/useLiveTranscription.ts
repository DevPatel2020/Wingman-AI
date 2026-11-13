import { useCallback, useEffect, useRef, useState } from "react"
import { AudioChunk, LiveRecorder, blobToBase64 } from "../../lib/liveRecorder"

/** Chunks whose loudest moment is below this RMS are treated as silence and never sent. */
const SILENCE_RMS_THRESHOLD = 0.012
const CHUNK_MS = 10_000

export interface TranscriptSegment {
  id: string
  startMs: number
  endMs: number
  text: string
}

export type TranscriptionStatus = "idle" | "starting" | "recording" | "stopping" | "stopped"

export interface StartOptions {
  title?: string
  includeSystemAudio: boolean
  consentConfirmed: boolean
}

export function useLiveTranscription() {
  const [status, setStatus] = useState<TranscriptionStatus>("idle")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [backend, setBackend] = useState<string>("")
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [level, setLevel] = useState(0)
  const [pending, setPending] = useState(0)
  const [skippedSilent, setSkippedSilent] = useState(0)
  const [systemAudioActive, setSystemAudioActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoryNotice, setMemoryNotice] = useState<string | null>(null)

  const recorderRef = useRef<LiveRecorder | null>(null)
  const sessionRef = useRef<string | null>(null)
  const inFlight = useRef(new Set<Promise<void>>())

  // Elapsed-time ticker while recording
  useEffect(() => {
    if (status !== "recording") return
    const id = window.setInterval(() => {
      setElapsedMs(recorderRef.current?.elapsedMs() ?? 0)
    }, 500)
    return () => window.clearInterval(id)
  }, [status])

  const handleChunk = useCallback((chunk: AudioChunk) => {
    const sid = sessionRef.current
    if (!sid) return
    if (chunk.peakLevel < SILENCE_RMS_THRESHOLD) {
      setSkippedSilent((n) => n + 1)
      return
    }
    setPending((n) => n + 1)
    const job = (async () => {
      try {
        const data = await blobToBase64(chunk.blob)
        const segment = await window.electronAPI.transcriptChunk({
          sessionId: sid,
          data,
          mimeType: chunk.mimeType,
          startMs: Math.round(chunk.startMs),
          endMs: Math.round(chunk.endMs)
        })
        if (segment) {
          setSegments((prev) => [...prev, segment].sort((a, b) => a.startMs - b.startMs))
          setError(null)
        }
      } catch (err: any) {
        setError(err?.message ?? String(err))
      } finally {
        setPending((n) => n - 1)
      }
    })()
    inFlight.current.add(job)
    job.finally(() => inFlight.current.delete(job))
  }, [])

  const start = useCallback(
    async (opts: StartOptions) => {
      if (!opts.consentConfirmed) return
      setError(null)
      setMemoryNotice(null)
      setSegments([])
      setSkippedSilent(0)
      setElapsedMs(0)
      setStatus("starting")

      const recorder = new LiveRecorder({
        includeSystemAudio: opts.includeSystemAudio,
        chunkMs: CHUNK_MS,
        onChunk: handleChunk,
        onLevel: setLevel
      })
      try {
        // Acquire devices first so a denied mic never creates an empty session.
        await recorder.start()
        const session = await window.electronAPI.transcriptStart({
          title: opts.title,
          consentConfirmed: true,
          source: recorder.systemAudioActive ? "mic+system" : "mic"
        })
        sessionRef.current = session.sessionId
        recorderRef.current = recorder
        setSessionId(session.sessionId)
        setBackend(session.backend)
        setSystemAudioActive(recorder.systemAudioActive)
        setStatus("recording")
      } catch (err: any) {
        await recorder.stop().catch(() => undefined)
        const msg =
          err?.name === "NotAllowedError"
            ? "Microphone access was denied. Allow microphone access in your system settings."
            : err?.name === "NotFoundError"
            ? "No microphone found."
            : err?.message ?? String(err)
        setError(msg)
        setStatus("idle")
      }
    },
    [handleChunk]
  )

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    const sid = sessionRef.current
    if (!recorder || !sid) return
    setStatus("stopping")
    await recorder.stop() // flushes the final chunk through handleChunk
    await Promise.all(inFlight.current)
    recorderRef.current = null
    try {
      const result = await window.electronAPI.transcriptStop(sid)
      setMemoryNotice(
        result.segmentCount === 0
          ? null
          : result.memoryWarning ?? "Saved to 🧠 Memory: you can now ask questions about this session."
      )
    } catch (err: any) {
      setError(err?.message ?? String(err))
    }
    setStatus("stopped")
  }, [])

  // Never leave the microphone open if the component unmounts mid-session.
  useEffect(() => {
    return () => {
      const sid = sessionRef.current
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => undefined)
        if (sid) window.electronAPI.transcriptStop(sid).catch(() => undefined)
      }
    }
  }, [])

  const reset = useCallback(() => {
    if (status === "recording" || status === "starting" || status === "stopping") return
    sessionRef.current = null
    setSessionId(null)
    setSegments([])
    setElapsedMs(0)
    setSkippedSilent(0)
    setError(null)
    setStatus("idle")
  }, [status])

  return {
    status,
    isRecording: status === "recording" || status === "starting" || status === "stopping",
    sessionId,
    backend,
    segments,
    elapsedMs,
    level,
    pending,
    skippedSilent,
    systemAudioActive,
    error,
    memoryNotice,
    start,
    stop,
    reset
  }
}

export type LiveTranscription = ReturnType<typeof useLiveTranscription>

export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
  const s = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}
