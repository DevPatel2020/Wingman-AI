import React, { useEffect, useState } from "react"
import { api, Deck, DeckSummary, errorMessage, Flashcard, Grade, SessionInfo } from "../../lib/api"
import { btnDanger, btnNeutral, btnPrimary, cardCls, headingCls, inputCls, panelCls } from "../common/styles"

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "review"; deck: DeckSummary; queue: Flashcard[]; flipped: boolean; done: number }
  | { kind: "quiz"; deck: Deck; index: number; picked: number | null; score: number }

const GRADES: Array<{ grade: Grade; label: string; cls: string }> = [
  { grade: "again", label: "Again", cls: "bg-red-500/80 hover:bg-red-500 text-white border-red-600/40" },
  { grade: "hard", label: "Hard", cls: "bg-amber-500/80 hover:bg-amber-500 text-white border-amber-600/40" },
  { grade: "good", label: "Good", cls: "bg-green-600/80 hover:bg-green-600 text-white border-green-700/40" },
  { grade: "easy", label: "Easy", cls: "bg-blue-500/80 hover:bg-blue-500 text-white border-blue-600/40" }
]

const CreateDeck: React.FC<{ onCreated: () => void; onCancel: () => void }> = ({ onCreated, onCancel }) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionId, setSessionId] = useState("")
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.sessions
      .list()
      .then((s) => {
        const usable = s.filter((x) => x.segmentCount > 0)
        setSessions(usable)
        if (usable[0]) setSessionId(usable[0].id)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [])

  const create = async (from: "session" | "text") => {
    setBusy(true)
    setError(null)
    try {
      if (from === "session") await api.study.fromSession(sessionId)
      else await api.study.fromText(title, text)
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className={headingCls}>New study deck</div>
      <div className={`${cardCls} space-y-2`}>
        <div className="font-medium">From a recorded session</div>
        {sessions.length === 0 ? (
          <div className="text-gray-500">No recorded sessions yet. Record a lecture in 📝 Notes first.</div>
        ) : (
          <div className="flex gap-2">
            <select className={inputCls} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({new Date(s.startedAt).toLocaleDateString()})
                </option>
              ))}
            </select>
            <button type="button" className={btnPrimary} disabled={busy || !sessionId} onClick={() => create("session")}>
              Generate
            </button>
          </div>
        )}
      </div>
      <div className={`${cardCls} space-y-2`}>
        <div className="font-medium">From your own notes</div>
        <input className={inputCls} placeholder="Deck title, e.g. OS: Scheduling" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className={`${inputCls} min-h-[90px] resize-y`}
          placeholder="Paste lecture notes, a textbook section or slides text…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="button" className={btnPrimary} disabled={busy || text.trim().length < 80} onClick={() => create("text")}>
          Generate
        </button>
      </div>
      {busy && <div className="text-gray-500 animate-pulse">Writing flashcards and a quiz…</div>}
      {error && <div className="text-red-600">⚠️ {error}</div>}
      <button type="button" className={btnNeutral} onClick={onCancel} disabled={busy}>
        ← Back
      </button>
    </div>
  )
}

const StudyPanel: React.FC = () => {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [view, setView] = useState<View>({ kind: "list" })
  const [error, setError] = useState<string | null>(null)

  const refresh = () =>
    api.study
      .list()
      .then(setDecks)
      .catch((err) => setError(errorMessage(err)))

  useEffect(() => {
    refresh()
  }, [])

  const startReview = async (deck: DeckSummary) => {
    try {
      const queue = await api.study.due(deck.id)
      setView({ kind: "review", deck, queue, flipped: false, done: 0 })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const startQuiz = async (deck: DeckSummary) => {
    try {
      const full = await api.study.get(deck.id)
      setView({ kind: "quiz", deck: full, index: 0, picked: null, score: 0 })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const grade = async (g: Grade) => {
    if (view.kind !== "review") return
    const [card, ...rest] = view.queue
    try {
      const updated = await api.study.review(view.deck.id, card.id, g)
      // "Again" brings the card back in this session (it is due in ~10 minutes).
      const queue = g === "again" ? [...rest, updated] : rest
      setView({ ...view, queue, flipped: false, done: view.done + 1 })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const deleteDeck = async (deck: DeckSummary) => {
    if (!window.confirm(`Delete the deck "${deck.title}"? This cannot be undone.`)) return
    await api.study.delete(deck.id).catch((err) => setError(errorMessage(err)))
    refresh()
  }

  const back = () => {
    setView({ kind: "list" })
    refresh()
  }

  return (
    <div className={panelCls}>
      {view.kind === "list" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={headingCls}>🎓 Study mode</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Flashcards with spaced repetition (SM-2) and quizzes generated from your lectures.
              </div>
            </div>
            <button type="button" className={btnPrimary} onClick={() => setView({ kind: "create" })}>
              ＋ New deck
            </button>
          </div>
          {decks.length === 0 ? (
            <div className="text-gray-500">No decks yet. Create one from a recorded lecture or pasted notes.</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {decks.map((d) => (
                <div key={d.id} className={`${cardCls} flex items-center justify-between gap-2`}>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 truncate">{d.title}</div>
                    <div className="text-[10px] text-gray-500">
                      {d.cardCount} cards · <span className={d.dueCount ? "text-green-700 font-semibold" : ""}>{d.dueCount} due</span> ·{" "}
                      {d.quizCount} quiz Qs{d.bestQuiz !== undefined && ` · best ${d.bestQuiz}%`}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" className={btnPrimary} disabled={d.dueCount === 0} onClick={() => startReview(d)}>
                      Review
                    </button>
                    <button type="button" className={btnNeutral} disabled={d.quizCount === 0} onClick={() => startQuiz(d)}>
                      Quiz
                    </button>
                    <button type="button" className={btnNeutral} onClick={() => deleteDeck(d)} title="Delete deck">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view.kind === "create" && <CreateDeck onCreated={back} onCancel={back} />}

      {view.kind === "review" &&
        (view.queue.length === 0 ? (
          <div className="space-y-3 text-center py-4">
            <div className="text-2xl">🎉</div>
            <div>
              You reviewed {view.done} card(s) from <strong>{view.deck.title}</strong>. Nothing else is due.
            </div>
            <button type="button" className={btnNeutral} onClick={back}>
              ← Back to decks
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-[11px] text-gray-500">
              <span>{view.deck.title}</span>
              <span>{view.queue.length} left</span>
            </div>
            <button
              type="button"
              className={`${cardCls} w-full min-h-[120px] text-left`}
              onClick={() => setView({ ...view, flipped: !view.flipped })}
            >
              <div className="text-sm text-gray-800 font-medium">{view.queue[0].front}</div>
              {view.flipped ? (
                <div className="mt-3 pt-3 border-t border-gray-200 text-gray-700 select-text">{view.queue[0].back}</div>
              ) : (
                <div className="mt-3 text-[11px] text-gray-400">Click to reveal the answer</div>
              )}
            </button>
            {view.flipped && (
              <div className="flex gap-1.5 justify-center">
                {GRADES.map((g) => (
                  <button key={g.grade} type="button" className={`rounded-md px-3 py-1.5 text-[11px] border ${g.cls}`} onClick={() => grade(g.grade)}>
                    {g.label}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className={btnNeutral} onClick={back}>
              ← End review
            </button>
          </div>
        ))}

      {view.kind === "quiz" &&
        (view.index >= view.deck.quiz.length ? (
          <div className="space-y-3 text-center py-4">
            <div className="text-lg font-semibold text-gray-800">
              {view.score} / {view.deck.quiz.length}
            </div>
            <div>{view.score === view.deck.quiz.length ? "Perfect score! 🎉" : "Review the flashcards and try again."}</div>
            <button type="button" className={btnNeutral} onClick={back}>
              ← Back to decks
            </button>
          </div>
        ) : (
          (() => {
            const q = view.deck.quiz[view.index]
            const answered = view.picked !== null
            const next = async () => {
              const isLast = view.index + 1 >= view.deck.quiz.length
              if (isLast) await api.study.recordQuiz(view.deck.id, view.score, view.deck.quiz.length).catch(() => undefined)
              setView({ ...view, index: view.index + 1, picked: null })
            }
            return (
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>{view.deck.title}</span>
                  <span>
                    Question {view.index + 1} / {view.deck.quiz.length} · score {view.score}
                  </span>
                </div>
                <div className="text-sm text-gray-800 font-medium">{q.question}</div>
                <div className="space-y-1.5">
                  {q.options.map((opt, i) => {
                    const state = !answered ? "" : i === q.answerIndex ? "bg-green-100 border-green-400" : i === view.picked ? "bg-red-100 border-red-400" : "opacity-60"
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={answered}
                        className={`w-full text-left rounded-lg border border-white/50 bg-white/70 hover:bg-white px-3 py-2 ${state}`}
                        onClick={() =>
                          setView({ ...view, picked: i, score: view.score + (i === q.answerIndex ? 1 : 0) })
                        }
                      >
                        {String.fromCharCode(65 + i)}. {opt}
                      </button>
                    )
                  })}
                </div>
                {answered && q.explanation && <div className="text-gray-600 select-text">💡 {q.explanation}</div>}
                <div className="flex gap-2">
                  {answered && (
                    <button type="button" className={btnPrimary} onClick={next}>
                      {view.index + 1 >= view.deck.quiz.length ? "Finish" : "Next →"}
                    </button>
                  )}
                  <button type="button" className={btnDanger} onClick={back}>
                    Quit quiz
                  </button>
                </div>
              </div>
            )
          })()
        ))}

      {error && <div className="text-red-600">⚠️ {error}</div>}
    </div>
  )
}

export default StudyPanel
