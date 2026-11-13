# ✈️ Wingman AI

<div align="center">
  <p><strong>An open-source, privacy-first AI copilot for meetings, lectures and interview preparation.</strong></p>

  [![CI](https://github.com/DevPatel2020/Wingman-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/DevPatel2020/Wingman-AI/actions/workflows/ci.yml)
  [![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
  [![LLM: Gemini | Ollama](https://img.shields.io/badge/LLM-Gemini%20%7C%20Ollama-orange.svg)]()
  [![STT: Whisper](https://img.shields.io/badge/STT-Whisper%20(local)-purple.svg)]()

  <p>
    Wingman AI is a desktop app that transcribes meetings and lectures live, turns them into structured notes,
    remembers everything so you can ask questions across past sessions (RAG with citations), builds flashcards
    and quizzes for revision, and coaches you with mock interview practice. It can run fully offline with
    Ollama and a local Whisper server.
  </p>
</div>

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 📝 | **Live notes** | Mixes your mic with meeting audio (Windows), transcribes it in 10-second chunks with timestamps, and writes notes covering the summary, decisions, action items and open questions. |
| 🧠 | **Meeting memory (RAG)** | Ask *"What did we decide about the launch date?"* across every saved session. Hybrid search (semantic + BM25) feeds an LLM that answers only from your meetings and cites each claim with a clickable meeting + timestamp. |
| 🎓 | **Study mode** | Turns a recorded lecture or pasted notes into flashcards and a multiple-choice quiz. Cards are scheduled with the **SM-2 spaced-repetition** algorithm. |
| 🎯 | **Interview practice** | An AI interviewer asks behavioral, technical, system-design or "explain it simply" questions. Answer by typing or voice and get a 1–10 score, a STAR breakdown, strengths, improvements and a model answer. Progress is tracked over time. |
| ✉️ | **Follow-up email** | Drafts a recap email (thank-you, decisions, action items) from a session. |
| 📸 | **Screen Q&A** | `Ctrl/Cmd + H` screenshots a slide, error or document and explains it. |
| 🔒 | **Local-first** | Use Ollama (LLM + embeddings) and a local Whisper server, and no audio or text leaves your machine. Everything is stored locally as JSON. |

## 🤝 Responsible by design

- **Consent before recording.** A session can't start until you confirm everyone present was told. The app gives you a ready-made announcement for the meeting chat.
- **Always-visible indicator.** A red `● REC` badge stays in the toolbar while recording, and the window title and tray tooltip show "● Recording".
- **Transparent window.** Wingman shows up in screen shares and the taskbar like any normal app.
- **Practice, not live assistance.** Interview mode is for preparation. Using AI assistance in exams or interviews where it isn't allowed is misconduct.
- **Your data stays yours.** Sessions can be deleted from the Memory panel, which also removes them from the search index.

Recording laws differ by country and state. You're responsible for following them.

---

## 🏗️ Architecture

```
┌─────────────────────────── Renderer (React + TypeScript) ───────────────────────────┐
│  📝 TranscriptPanel   🧠 MemoryPanel   🎓 StudyPanel   🎯 PracticePanel               │
│        │                                                                            │
│  LiveRecorder: getUserMedia (mic) + getDisplayMedia (system loopback) → WebAudio    │
│  mix → RMS meter → rotating MediaRecorder → self-contained 10 s chunks (silence     │
│  skipped)                                                                           │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        │ contextBridge IPC
┌───────────────────────────────────────▼──────────────── Main process (Electron) ────┐
│  TranscriptionService ─┬─ Local Whisper (OpenAI-compatible API)                     │
│   + hallucination filter └─ Gemini (multimodal)                                     │
│  TranscriptStore ── per-session FIFO queue → JSON + Markdown export                 │
│                                                                                     │
│  MemoryStore (RAG)                                                                  │
│   index:  transcript → overlapping time-window chunks + notes sections              │
│           → EmbeddingService (Ollama nomic-embed-text | Gemini embedding, 768-d)    │
│   query:  BM25 ranking ┐                                                            │
│           cosine rank  ┴→ Reciprocal Rank Fusion → top-6 → grounded, cited answer   │
│                                                                                     │
│  StudyStore (LLM → flashcards/quiz JSON, SM-2 scheduling)                           │
│  PracticeStore (question generation, rubric scoring, history)                       │
│  LLMHelper ── Gemini 2.5 Flash-Lite | Ollama                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Engineering notes

- **Decodable audio chunks.** `MediaRecorder` timeslice chunks can't be decoded on their own (only the first has the WebM header). The recorder *rotates*: it starts a new recorder on the same stream, then stops the old one, so every chunk is a complete file.
- **Silence and hallucination handling.** Chunks below an RMS threshold are never sent, which saves API calls. A text filter drops typical Whisper hallucinations on silence ("Thank you.", `[BLANK_AUDIO]`).
- **Ordered, rate-friendly STT.** Chunks for a session are transcribed through a FIFO queue, so the transcript stays in order and the backend never gets flooded.
- **Hybrid retrieval.** Keyword search (BM25 with light stemming) catches names, numbers and jargon, and embeddings catch paraphrases. Reciprocal Rank Fusion merges the two rankings without score calibration. If embeddings are unavailable (no key, model not pulled, offline), memory degrades to keyword-only instead of failing.
- **Grounded answers.** The LLM sees only the numbered retrieved chunks and must cite them `[n]`. The UI turns each citation into a chip that reveals the exact source text, meeting and timestamp.
- **Embedding hygiene.** Each vector stores its model id, so vectors from different models are never compared. Truncated (Matryoshka) Gemini vectors are re-normalized before cosine similarity.
- **Robust LLM JSON.** Study and practice parse model output defensively (fence stripping, first-object extraction, schema validation) and discard malformed items.

### Quality

`npm test` runs 31 unit tests (chunking, BM25, RRF, cosine, SM-2, JSON extraction, the hallucination filter) plus a **retrieval evaluation** on a labelled set of meeting questions. CI fails if quality regresses.

| Retriever | Hit@1 | Hit@3 | MRR |
|---|---|---|---|
| BM25 (keyword, offline) | 0.83 | 0.92 | 0.875 |

```bash
npm run eval
```

---

## 🛠️ Tech stack

- **Desktop:** Electron 33, TypeScript
- **UI:** React 18, Tailwind CSS, Vite
- **LLMs:** Google Gemini 2.5 Flash-Lite or Ollama (e.g. Llama 3.2)
- **Embeddings:** Ollama `nomic-embed-text` or Gemini `gemini-embedding-001`
- **Speech-to-text:** local Whisper via any OpenAI-compatible server (e.g. [speaches](https://github.com/speaches-ai/speaches)), or Gemini
- **Testing / CI:** Vitest, GitHub Actions (Windows + Ubuntu)

---

## 🚀 Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 20+
- **Either** a Gemini API key ([Google AI Studio](https://aistudio.google.com/app/apikey)) **or** [Ollama](https://ollama.com)

### Install

```bash
git clone https://github.com/DevPatel2020/Wingman-AI.git "Wingman AI"
cd "Wingman AI"
npm install
```

### Configure

Copy `env.example` to `.env`. Common setups:

**Cloud (simplest)**
```env
GEMINI_API_KEY=your_key
```

**Fully local / private**
```env
USE_OLLAMA=true
OLLAMA_MODEL=llama3.2
WHISPER_URL=http://localhost:8000/v1/audio/transcriptions
```
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
docker run --rm -p 8000:8000 ghcr.io/speaches-ai/speaches:latest-cpu
```

### Run

```bash
npm start          # development
npm test           # unit tests + retrieval eval
npm run typecheck  # renderer + Electron
npm run dist       # installers → ./release
```

---

## 🎮 Using it

1. **📝 Notes:** tell participants, tick the consent box, and click **Start recording**. Click **Stop** when done. The session is saved and added to memory automatically. Use **✨ Generate notes**, **✉️ Follow-up email**, **Copy** or **Export .md**.
2. **🧠 Memory:** ask questions across all sessions. Click a citation number to see the source.
3. **🎓 Study:** click **New deck**, pick a recorded lecture (or paste notes), then **Review** due cards or take the **Quiz**.
4. **🎯 Practice:** pick a track and a target role, click **Start**, answer by text or voice, and click **Get feedback**.

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Show / hide the window |
| `Cmd/Ctrl + Shift + Space` | Center and show the window |
| `Cmd/Ctrl + H` | Screenshot and explain |
| `Cmd/Ctrl + Enter` | Process queued screenshots |
| `Cmd/Ctrl + R` | Reset |
| `Cmd/Ctrl + Arrows` | Move the window |
| `Cmd/Ctrl + Q` | Quit |

Data lives in the app data folder (`%APPDATA%/wingman-ai` on Windows, `~/Library/Application Support/wingman-ai` on macOS): `transcripts/`, `memory/index.json`, `study/decks.json`, `practice/history.json`.

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Gemini LLM, transcription and embeddings | — |
| `USE_OLLAMA`, `OLLAMA_MODEL`, `OLLAMA_URL` | Local LLM | `false`, `llama3.2`, `http://localhost:11434` |
| `WHISPER_URL`, `WHISPER_MODEL`, `WHISPER_LANGUAGE` | Local speech-to-text | unset → Gemini |
| `TRANSCRIPTION_PROVIDER` | Force `whisper` or `gemini` | auto |
| `EMBEDDING_PROVIDER` | Force `ollama`, `gemini` or `none` | follows the LLM |
| `OLLAMA_EMBED_MODEL`, `GEMINI_EMBED_MODEL` | Embedding models | `nomic-embed-text`, `gemini-embedding-001` |

---

## 🗺️ Roadmap

- [x] Consent-gated live transcription with recording indicator
- [x] AI meeting notes, follow-up emails, Markdown export
- [x] Meeting memory: hybrid RAG with citations
- [x] Study mode: flashcards, quizzes, SM-2 spaced repetition
- [x] Interview practice with rubric feedback and progress tracking
- [x] Unit tests, retrieval eval, CI
- [ ] Speaker diarization ("who said what")
- [ ] Semantic retrieval eval (embedding vs. keyword vs. hybrid comparison)
- [ ] Calendar / task-manager integrations with human approval

---

## 🔧 Troubleshooting

- **"Cloud transcription needs a Gemini API key":** Ollama models can't process audio. Add `GEMINI_API_KEY`, or run a Whisper server and set `WHISPER_URL`.
- **Memory says "keyword search only":** run `ollama pull nomic-embed-text` (Ollama) or add a Gemini key, then click **↻ Re-index** in the Memory panel.
- **Only my voice is transcribed:** tick "Also capture meeting audio" (Windows), or play the call through speakers instead of headphones.
- **Port 5180 in use:** stop the process using it and retry.

## 📄 License

[ISC](LICENSE).
