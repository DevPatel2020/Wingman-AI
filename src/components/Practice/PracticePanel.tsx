import React, { useEffect, useRef, useState } from "react"
import { api, errorMessage, PracticeAttempt, PracticeTrack } from "../../lib/api"
import { blobToBase64 } from "../../lib/liveRecorder"
import { btnDanger, btnNeutral, btnPrimary, cardCls, headingCls, inputCls, panelCls } from "../common/styles"

const TRACKS: Array<{ id: PracticeTrack; label: string }> = [
  { id: "behavioral", label: "Behavioral (STAR)" },
  { id: "technical", label: "Technical concepts" },
  { id: "system-design", label: "System design" },
  { id: "presentation", label: "Explain it simply" }
]

type Stats = { attempts: number; average: number | null; recentAverage: number | null }

/** Records one spoken answer and transcribes it in a single request. */
function useVoiceAnswer(onText: (text: string) => void, onError: (msg: string) => void) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle")
  const recorder = useRef<MediaRecorder | null>(null)

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm"
      const rec = new MediaRecorder(stream, { mimeType })
      const parts: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setState("transcribing")
        try {
          const blob = new Blob(parts, { type: rec.mimeType || mimeType })
          const text = await api.transcribeOnce(await blobToBase64(blob), blob.type)
          if (text) onText(text)
          else onError("No speech was detected. Try again closer to the mic.")
        } catch (err) {
          onError(errorMessage(err))
        } finally {
          setState("idle")
        }
      }
      rec.start()
      recorder.current = rec
      setState("recording")
    } catch (err: any) {
      onError(err?.name === "NotAllowedError" ? "Microphone access was denied." : errorMessage(err))
    }
  }

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop()
  }
  useEffect(() => () => stop(), [])
  return { state, start, stop }
}

const Feedback: React.FC<{ attempt: PracticeAttempt }> = ({ attempt }) => {
  const f = attempt.feedback
  const color = f.score >= 8 ? "text-green-700" : f.score >= 5 ? "text-amber-600" : "text-red-600"
  return (
    <div className={`${cardCls} space-y-2 max-h-80 overflow-y-auto select-text`}>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${color}`}>{f.score}/10</span>
        <span className="text-gray-700">{f.summary}</span>
      </div>
      {f.star && (
        <div className="flex gap-1.5 flex-wrap">
          {(["situation", "task", "action", "result"] as const).map((k) => (
            <span
              key={k}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${f.star![k] ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}
            >
              {f.star![k] ? "✓" : "✗"} {k[0].toUpperCase() + k.slice(1)}
            </span>
          ))}
        </div>
      )}
      {f.strengths.length > 0 && (
        <div>
          <div className="font-semibold text-gray-800">Strengths</div>
          <ul className="list-disc ml-4">{f.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {f.improvements.length > 0 && (
        <div>
          <div className="font-semibold text-gray-800">To improve</div>
          <ul className="list-disc ml-4">{f.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {f.sampleAnswer && (
        <details>
          <summary className="cursor-pointer font-semibold text-gray-800">Model answer outline</summary>
          <div className="mt-1 whitespace-pre-wrap text-gray-700">{f.sampleAnswer}</div>
        </details>
      )}
    </div>
  )
}

const PracticePanel: React.FC = () => {
  const [track, setTrack] = useState<PracticeTrack>("behavioral")
  const [role, setRole] = useState("Software Engineer Intern")
  const [question, setQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState("")
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null)
  const [busy, setBusy] = useState<"question" | "evaluate" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<PracticeAttempt[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const voice = useVoiceAnswer(
    (text) => setAnswer((prev) => (prev ? `${prev} ${text}` : text)),
    (msg) => setError(msg)
  )

  const refresh = () =>
    api.practice
      .history()
      .then((r) => {
        setStats(r.stats)
        setHistory(r.history)
      })
      .catch(() => undefined)

  useEffect(() => {
    refresh()
  }, [])

  const newQuestion = async () => {
    setBusy("question")
    setError(null)
    setAttempt(null)
    setAnswer("")
    try {
      setQuestion(await api.practice.question(track, role))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const submit = async () => {
    if (!question) return
    setBusy("evaluate")
    setError(null)
    try {
      setAttempt(await api.practice.evaluate({ track, role, question, answer }))
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={panelCls}>
      <div>
        <div className={headingCls}>🎯 Interview practice</div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          Rehearse with an AI interviewer and get scored feedback. Use it to prepare, not during a real interview.
        </div>
        {stats && stats.attempts > 0 && (
          <div className="text-[10px] text-gray-500 mt-1">
            {stats.attempts} answers practiced · average {stats.average}/10 · last 5: {stats.recentAverage}/10
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <select className={inputCls} value={track} onChange={(e) => setTrack(e.target.value as PracticeTrack)} disabled={!!busy}>
          {TRACKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Target role" disabled={!!busy} />
      </div>

      <button type="button" className={btnPrimary} onClick={newQuestion} disabled={!!busy}>
        {busy === "question" ? "Thinking of a question…" : question ? "↻ Different question" : "Start: ask me a question"}
      </button>

      {question && (
        <>
          <div className={`${cardCls} text-sm text-gray-800 font-medium select-text`}>🗣️ {question}</div>
          {!attempt && (
            <>
              <textarea
                className={`${inputCls} min-h-[100px] resize-y`}
                placeholder="Type your answer, or record it with the mic button…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={busy === "evaluate"}
              />
              <div className="flex gap-2 items-center">
                {voice.state === "recording" ? (
                  <button type="button" className={btnDanger} onClick={voice.stop}>
                    ■ Stop recording
                  </button>
                ) : (
                  <button type="button" className={btnNeutral} onClick={voice.start} disabled={voice.state !== "idle" || !!busy}>
                    {voice.state === "transcribing" ? "Transcribing…" : "🎤 Answer by voice"}
                  </button>
                )}
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={submit}
                  disabled={!!busy || voice.state !== "idle" || answer.trim().length < 20}
                >
                  {busy === "evaluate" ? "Reviewing…" : "Get feedback"}
                </button>
              </div>
            </>
          )}
          {attempt && <Feedback attempt={attempt} />}
        </>
      )}

      {error && <div className="text-red-600">⚠️ {error}</div>}

      {history.length > 0 && (
        <div>
          <button type="button" className="text-[11px] text-gray-600 underline" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "Hide" : "Show"} recent attempts
          </button>
          {showHistory && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {history.map((h) => (
                <div key={h.id} className="flex justify-between gap-2 rounded bg-white/60 px-2 py-1">
                  <span className="truncate text-gray-700">{h.question}</span>
                  <span className="shrink-0 font-semibold">{h.feedback.score}/10</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PracticePanel
