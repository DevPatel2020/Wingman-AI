import React, { useEffect, useRef, useState } from "react"
import FormattedMessage from "../Queue/FormattedMessage"
import { LiveTranscription, formatOffset } from "./useLiveTranscription"
import { api, errorMessage } from "../../lib/api"

const ANNOUNCEMENT =
  "Heads up: I'm using Wingman AI to transcribe and take notes for this meeting. " +
  "Let me know if you'd prefer I don't, and I'll turn it off."

interface TranscriptPanelProps {
  live: LiveTranscription
}

const buttonCls =
  "rounded-md px-2.5 py-1 text-[11px] leading-none border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
const neutralBtn = `${buttonCls} bg-white/60 hover:bg-white/80 text-gray-700 border-gray-300/60`

/** Consent step shown before any audio is captured. */
const ConsentStep: React.FC<{ live: LiveTranscription }> = ({ live }) => {
  const [informed, setInformed] = useState(false)
  const [includeSystem, setIncludeSystem] = useState(false)
  const [title, setTitle] = useState("")
  const [copied, setCopied] = useState(false)
  const supportsSystemAudio = window.electronAPI.platform === "win32"

  const copyAnnouncement = async () => {
    await navigator.clipboard.writeText(ANNOUNCEMENT)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3 text-xs text-gray-700">
      <div>
        <div className="font-semibold text-gray-800 text-sm">📝 Start live notes</div>
        <p className="text-gray-600 mt-1 leading-relaxed">
          Wingman transcribes audio in 10-second chunks and can turn it into meeting notes.
          Recording people without telling them is unethical and, in many places, illegal.
        </p>
      </div>

      <input
        className="w-full rounded-lg px-3 py-2 bg-white/60 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400/60 border border-white/40"
        placeholder="Session title (optional), e.g. CS301 Lecture 7 or Sprint planning"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="rounded-lg bg-white/50 border border-white/40 p-2.5 space-y-2">
        <div className="text-[11px] text-gray-600">Suggested message for the meeting chat:</div>
        <div className="italic text-gray-700">“{ANNOUNCEMENT}”</div>
        <button type="button" className={neutralBtn} onClick={copyAnnouncement}>
          {copied ? "✓ Copied" : "📋 Copy message"}
        </button>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={informed}
          onChange={(e) => setInformed(e.target.checked)}
        />
        <span>
          I've told <strong>everyone</strong> in this session that I'm recording and transcribing it.
        </span>
      </label>

      {supportsSystemAudio && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeSystem}
            onChange={(e) => setIncludeSystem(e.target.checked)}
          />
          <span>
            Also capture meeting audio (system sound), so other participants are transcribed, not
            just your microphone.
          </span>
        </label>
      )}

      {live.error && <div className="text-red-600">⚠️ {live.error}</div>}

      <button
        type="button"
        disabled={!informed || live.status === "starting"}
        className={`${buttonCls} bg-red-500/80 hover:bg-red-500 text-white border-red-600/40 px-3 py-1.5`}
        onClick={() =>
          live.start({ title, includeSystemAudio: includeSystem, consentConfirmed: informed })
        }
      >
        {live.status === "starting" ? "Starting…" : "● Start recording"}
      </button>
    </div>
  )
}

const LevelMeter: React.FC<{ level: number }> = ({ level }) => {
  const pct = Math.min(100, Math.round(Math.sqrt(level) * 220))
  return (
    <div className="h-1.5 w-20 rounded-full bg-gray-300/60 overflow-hidden" title="Input level">
      <div className="h-full bg-green-500 transition-[width] duration-100" style={{ width: `${pct}%` }} />
    </div>
  )
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ live }) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [live.segments.length])

  useEffect(() => {
    if (live.status === "idle") {
      setSummary(null)
      setEmail(null)
    }
  }, [live.status])

  if (live.status === "idle" || live.status === "starting") {
    return (
      <div className="mt-4 w-full liquid-glass chat-container p-4">
        <ConsentStep live={live} />
      </div>
    )
  }

  const sid = live.sessionId!
  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 2500)
  }

  const handleSummarize = async () => {
    setSummarizing(true)
    try {
      setSummary(await window.electronAPI.transcriptSummarize(sid))
    } catch (err: any) {
      flash(`⚠️ ${err?.message ?? err}`)
    } finally {
      setSummarizing(false)
    }
  }

  const handleFollowUp = async () => {
    setDrafting(true)
    try {
      setEmail(await api.followUp(sid))
    } catch (err) {
      flash(`⚠️ ${errorMessage(err)}`)
    } finally {
      setDrafting(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(await window.electronAPI.transcriptGetMarkdown(sid))
    flash("✓ Notes copied as Markdown")
  }

  const handleExport = async () => {
    const res = await window.electronAPI.transcriptExport(sid)
    if (res.saved) flash(`✓ Saved to ${res.path}`)
  }

  const recording = live.status === "recording"

  return (
    <div className="mt-4 w-full liquid-glass chat-container p-4 flex flex-col gap-3 text-xs text-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {recording ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/90 text-white px-2 py-0.5 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              REC {formatOffset(live.elapsedMs)}
            </span>
          ) : (
            <span className="rounded-full bg-gray-500/70 text-white px-2 py-0.5 text-[11px]">
              {live.status === "stopping" ? "Finishing…" : `Stopped · ${formatOffset(live.elapsedMs)}`}
            </span>
          )}
          {recording && <LevelMeter level={live.level} />}
        </div>
        <div className="text-[10px] text-gray-500 text-right leading-tight">
          {live.backend}
          <br />
          {live.systemAudioActive ? "mic + meeting audio" : "microphone"}
          {live.skippedSilent > 0 && ` · ${live.skippedSilent} silent chunk(s) skipped`}
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={listRef}
        className="max-h-64 min-h-[100px] overflow-y-auto rounded-lg bg-white/70 border border-white/40 p-3 space-y-2 select-text"
      >
        {live.segments.length === 0 ? (
          <div className="text-gray-500 text-center mt-6">
            {recording ? "Listening… the first lines appear about 10 seconds after you start speaking." : "Nothing was transcribed."}
          </div>
        ) : (
          live.segments.map((s) => (
            <div key={s.id} className="flex gap-2 leading-relaxed">
              <span className="text-gray-400 font-mono shrink-0">{formatOffset(s.startMs)}</span>
              <span className="text-gray-800">{s.text}</span>
            </div>
          ))
        )}
        {live.pending > 0 && <div className="text-gray-400 animate-pulse">Transcribing…</div>}
      </div>

      {live.error && <div className="text-red-600">⚠️ {live.error}</div>}

      {summary && (
        <div className="max-h-72 overflow-y-auto rounded-lg bg-white/85 border border-gray-200/60 p-3 select-text">
          <FormattedMessage text={summary} />
        </div>
      )}

      {email && (
        <div className="rounded-lg bg-white/85 border border-gray-200/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800">✉️ Follow-up email draft</span>
            <button
              type="button"
              className={neutralBtn}
              onClick={async () => {
                await navigator.clipboard.writeText(email)
                flash("✓ Email copied")
              }}
            >
              Copy
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap text-gray-700 select-text">{email}</div>
        </div>
      )}

      {live.memoryNotice && live.status === "stopped" && (
        <div className="text-[11px] text-gray-600">🧠 {live.memoryNotice}</div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <button
            type="button"
            className={`${buttonCls} bg-red-500/80 hover:bg-red-500 text-white border-red-600/40`}
            onClick={live.stop}
          >
            ■ Stop
          </button>
        ) : (
          <button type="button" className={neutralBtn} onClick={live.reset} disabled={live.status === "stopping"}>
            ＋ New session
          </button>
        )}
        <button
          type="button"
          className={neutralBtn}
          onClick={handleSummarize}
          disabled={summarizing || live.segments.length === 0}
        >
          {summarizing ? "Writing notes…" : "✨ Generate notes"}
        </button>
        <button
          type="button"
          className={neutralBtn}
          onClick={handleFollowUp}
          disabled={drafting || live.segments.length === 0}
        >
          {drafting ? "Drafting…" : "✉️ Follow-up email"}
        </button>
        <button type="button" className={neutralBtn} onClick={handleCopy} disabled={live.segments.length === 0}>
          📋 Copy
        </button>
        <button type="button" className={neutralBtn} onClick={handleExport} disabled={live.segments.length === 0}>
          ⬇ Export .md
        </button>
        {notice && <span className="text-[11px] text-gray-600 truncate max-w-[220px]">{notice}</span>}
      </div>
    </div>
  )
}

export default TranscriptPanel
