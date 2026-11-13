import React, { useEffect, useState } from "react"
import { api, errorMessage, MemoryAnswer, MemoryStats, SessionInfo } from "../../lib/api"
import { formatOffset } from "../Transcript/useLiveTranscription"
import { btnNeutral, btnPrimary, cardCls, headingCls, inputCls, panelCls } from "../common/styles"

const EXAMPLES = [
  "What did we decide about the deadline?",
  "Which action items were assigned to me?",
  "Explain the main idea from last week's lecture"
]

/** Renders answer text, turning [n] markers into clickable citation chips. */
const CitedAnswer: React.FC<{ answer: MemoryAnswer; onCite: (n: number) => void; active: number | null }> = ({
  answer,
  onCite,
  active
}) => {
  const parts = answer.answer.split(/(\[\d+\])/g)
  return (
    <div className="leading-relaxed whitespace-pre-wrap select-text text-gray-800">
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/)
        if (!m) return <span key={i}>{part}</span>
        const n = Number(m[1])
        const exists = answer.citations.some((c) => c.n === n)
        return exists ? (
          <button
            key={i}
            type="button"
            onClick={() => onCite(n)}
            className={`mx-0.5 rounded px-1 text-[10px] font-semibold align-baseline ${
              active === n ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {n}
          </button>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </div>
  )
}

const MemoryPanel: React.FC = () => {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<MemoryAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const [activeCite, setActiveCite] = useState<number | null>(null)
  const [reindexing, setReindexing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const [st, ss] = await Promise.all([api.memory.stats(), api.sessions.list()])
      setStats(st)
      setSessions(ss)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const ask = async (q = question) => {
    if (!q.trim()) return
    setQuestion(q)
    setLoading(true)
    setError(null)
    setActiveCite(null)
    try {
      setAnswer(await api.memory.ask(q))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const reindex = async () => {
    setReindexing(true)
    setNotice(null)
    try {
      const r = await api.memory.reindexAll()
      setNotice(`Indexed ${r.sessions} session(s) into ${r.chunks} chunks.${r.warnings.length ? ` ⚠️ ${r.warnings[0]}` : ""}`)
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setReindexing(false)
    }
  }

  const removeSession = async (s: SessionInfo) => {
    if (!window.confirm(`Delete "${s.title}" and its transcript permanently? This cannot be undone.`)) return
    try {
      await api.sessions.delete(s.id)
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const cited = answer?.citations.find((c) => c.n === activeCite)

  return (
    <div className={panelCls}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={headingCls}>🧠 Meeting memory</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Ask anything about your saved meetings and lectures. Answers cite their sources.
          </div>
        </div>
        <button type="button" className={btnNeutral} onClick={reindex} disabled={reindexing}>
          {reindexing ? "Indexing…" : "↻ Re-index"}
        </button>
      </div>

      {stats && (
        <div className="text-[10px] text-gray-500">
          {stats.sessions} session(s) · {stats.chunks} chunks ·{" "}
          {stats.embeddingModel === "none"
            ? "keyword search (no embedding model)"
            : `${stats.embedded}/${stats.chunks} embedded with ${stats.embeddingModel}`}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          ask()
        }}
      >
        <input
          className={inputCls}
          placeholder="e.g. What did we decide about the API launch?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className={btnPrimary} disabled={loading || !question.trim()}>
          {loading ? "…" : "Ask"}
        </button>
      </form>

      {!answer && !loading && stats?.chunks === 0 && (
        <div className="text-gray-500">
          Nothing saved yet. Record a session in 📝 Notes. It's added to memory automatically when you stop.
        </div>
      )}
      {!answer && !loading && !!stats?.chunks && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className={btnNeutral} onClick={() => ask(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <div className="text-red-600">⚠️ {error}</div>}

      {answer && (
        <div className={`${cardCls} space-y-2 max-h-72 overflow-y-auto`}>
          <CitedAnswer answer={answer} onCite={(n) => setActiveCite(activeCite === n ? null : n)} active={activeCite} />
          {cited && (
            <div className="rounded-md bg-gray-100 border border-gray-200 p-2 text-[11px]">
              <div className="font-semibold text-gray-700">
                [{cited.n}] {cited.title} · {new Date(cited.startedAt).toLocaleDateString()} ·{" "}
                {cited.kind === "notes" ? "AI notes" : `${formatOffset(cited.startMs)}–${formatOffset(cited.endMs)}`}
              </div>
              <div className="text-gray-600 mt-1 whitespace-pre-wrap select-text">{cited.text}</div>
            </div>
          )}
          <div className="text-[10px] text-gray-400">
            {answer.mode === "hybrid" ? "Hybrid search (semantic + keyword)" : "Keyword search"} ·{" "}
            {answer.citations.length} source(s)
            {answer.warning && <span className="text-amber-600"> · {answer.warning}</span>}
          </div>
        </div>
      )}

      {notice && <div className="text-[11px] text-gray-600">{notice}</div>}

      <div>
        <button type="button" className="text-[11px] text-gray-600 underline" onClick={() => setShowSessions(!showSessions)}>
          {showSessions ? "Hide" : "Show"} saved sessions ({sessions.length})
        </button>
        {showSessions && (
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded bg-white/60 px-2 py-1">
                <div className="truncate">
                  <span className="text-gray-800">{s.title}</span>
                  <span className="text-gray-400">
                    {" "}
                    · {new Date(s.startedAt).toLocaleDateString()} · {s.segmentCount} lines
                    {s.hasNotes && " · notes"}
                    {!s.inMemory && " · not indexed"}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-red-500/80 hover:text-red-600 text-[11px] shrink-0"
                  onClick={() => removeSession(s)}
                  title="Delete session"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MemoryPanel
