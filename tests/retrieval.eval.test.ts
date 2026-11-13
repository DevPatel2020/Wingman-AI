// Retrieval evaluation for meeting memory.
// A small labelled corpus of meeting chunks + natural-language questions with
// the chunk that answers each one. Reports Hit@1, Hit@3 and MRR for the
// keyword (BM25) retriever, and fails CI if quality regresses.
//
// Run with:  npm run eval

import { describe, expect, it } from "vitest"
import { BM25 } from "../electron/ragCore"

const corpus: Array<{ id: string; text: string }> = [
  { id: "standup-db", text: "Priya said the Postgres migration is blocked on the schema review; she expects to finish it by Thursday." },
  { id: "standup-ui", text: "Arjun is redesigning the settings page and will share Figma mockups with the team tomorrow morning." },
  { id: "planning-deadline", text: "We agreed to move the public launch from March 3 to March 17 so QA has two full weeks." },
  { id: "planning-budget", text: "Marketing budget for the launch stays at five thousand dollars, mostly for paid social ads." },
  { id: "planning-owner", text: "Dev owns the release checklist and will send the go/no-go email the day before launch." },
  { id: "lecture-tcp", text: "TCP uses a three-way handshake: SYN, SYN-ACK, ACK, before any application data is exchanged." },
  { id: "lecture-udp", text: "UDP is connectionless; it has no handshake, no retransmission and no ordering guarantees, which suits live video." },
  { id: "lecture-congestion", text: "Congestion control in TCP starts with slow start, doubling the window every round trip until loss occurs." },
  { id: "client-pricing", text: "The client asked for a discount on the annual plan; we offered fifteen percent if they sign before June." },
  { id: "client-feedback", text: "They loved the dashboard export feature but found onboarding confusing, especially the API key step." },
  { id: "retro-good", text: "In the retro, everyone liked the shorter standups and pairing on difficult bugs." },
  { id: "retro-bad", text: "The main complaint was flaky end-to-end tests that kept blocking merges on the main branch." }
]

const queries: Array<{ q: string; expected: string }> = [
  { q: "When is the database migration going to be done?", expected: "standup-db" },
  { q: "Who is sending the go/no-go email?", expected: "planning-owner" },
  { q: "What is the new launch date?", expected: "planning-deadline" },
  { q: "How much is the marketing budget?", expected: "planning-budget" },
  { q: "Explain the TCP handshake", expected: "lecture-tcp" },
  { q: "Why is UDP used for live video?", expected: "lecture-udp" },
  { q: "How does slow start work?", expected: "lecture-congestion" },
  { q: "What discount did we offer the client?", expected: "client-pricing" },
  { q: "What did the client think about onboarding?", expected: "client-feedback" },
  { q: "What went wrong according to the retro?", expected: "retro-bad" },
  { q: "When will we see the settings mockups?", expected: "standup-ui" },
  { q: "Which tests were flaky?", expected: "retro-bad" }
]

describe("meeting memory retrieval eval (BM25)", () => {
  const bm25 = new BM25(corpus.map((c) => c.text))
  const ranks = queries.map(({ q, expected }) => {
    const order = bm25.rank(q).map(([i]) => corpus[i].id)
    const pos = order.indexOf(expected)
    return pos === -1 ? Infinity : pos + 1
  })
  const hitAt = (k: number) => ranks.filter((r) => r <= k).length / ranks.length
  const mrr = ranks.reduce((s, r) => s + (Number.isFinite(r) ? 1 / r : 0), 0) / ranks.length

  it("reports metrics", () => {
    console.log(
      `Retrieval eval (${queries.length} queries): Hit@1=${hitAt(1).toFixed(2)} Hit@3=${hitAt(3).toFixed(2)} MRR=${mrr.toFixed(3)}`
    )
  })

  it("Hit@3 stays at or above 0.9", () => {
    expect(hitAt(3)).toBeGreaterThanOrEqual(0.9)
  })

  it("MRR stays at or above 0.75", () => {
    expect(mrr).toBeGreaterThanOrEqual(0.75)
  })
})
