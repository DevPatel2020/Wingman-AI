# ✈️ Wingman AI (Formerly Cluely)

<div align="center">
  <p><strong>The ultimate invisible, real-time AI desktop assistant.</strong></p>
  
  [![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
  [![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
  [![AI: Gemini 2.5 Flash Lite](https://img.shields.io/badge/AI-Gemini%202.5%20Flash%20Lite-orange.svg)]()
  [![AI: Ollama](https://img.shields.io/badge/AI-Ollama-green.svg)]()
  
  <p>
    Built for developers, professionals, and students. Wingman AI provides live, context-aware support during meetings, interviews, and pairing sessions. Triggered via global hotkeys, it operates as an invisible overlay that silently analyzes your live screen and microphone audio, delivering highly accurate coding solutions and suggestions in <strong>under 2 seconds</strong>.
  </p>
</div>

---

## ✨ Why Wingman AI?

By intelligently routing requests between **Gemini 2.5 Flash-Lite** for blazing-fast multimodal processing and **local Ollama LLMs** for secure, offline execution, Wingman AI offers a perfect balance of speed, capability, and privacy.

- **👻 Invisible UI:** Operates silently in the background with a transparent, always-on-top overlay.
- **⚡ Blazing Fast (< 2s):** Optimized architecture guarantees complex multimodal processing (vision + audio) in `< 2 seconds`.
- **👁️ Multimodal Context:** Understands your exact situation by analyzing both live screen captures and active microphone audio.
- **🔒 Privacy-First Routing:** Dynamically fall back to local execution via Ollama for maximum data privacy.
- **⌨️ Global Hotkeys:** Never break your workflow; control the entire assistant without clicking away from your IDE or meeting.

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, TailwindCSS
- **Desktop Environment:** Electron
- **Cloud AI Integration:** Google Generative AI (Gemini 2.5 Flash-Lite)
- **Local AI Integration:** Ollama (Llama 3.2, etc.)

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) installed
- [Git](https://git-scm.com/) installed
- **Either** a Gemini API key (get it from [Google AI Studio](https://aistudio.google.com/app/apikey))
- **Or** Ollama installed locally for private LLM usage (recommended for high privacy)

### Installation Steps

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/wingman-ai.git
cd wingman-ai
```

2. **Install dependencies:**
```bash
npm install
```
*(If you encounter Sharp/Python build errors, run `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --ignore-scripts` followed by `npm rebuild sharp`)*

3. **Set up environment variables:**
   Create a `.env` file in the root folder:
   
   **For Gemini (Cloud AI):**
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   
   **For Ollama (Local/Private AI):**
   ```env
   USE_OLLAMA=true
   OLLAMA_MODEL=llama3.2
   OLLAMA_URL=http://localhost:11434
   ```

### Running the App

**Development Mode (Recommended for first run)**
```bash
npm start
```

**Production Build**
```bash
npm run dist
```
The built app will be generated in the `release` folder.

---

## 🤖 AI Provider Options

### 1. Google Gemini (Gemini 2.5 Flash-Lite)
**Best for:** Ultimate speed and multimodal (audio/vision) tasks.
- **Pros:** Blazing fast (< 2 sec output), best accuracy, supports audio transcription and screen analysis.
- **Cons:** Requires an API key and internet connection.
- **Cost:** Practically free! Gemini 2.5 Flash-Lite costs just ~$0.075 per 1 Million tokens. You can set up a budget of $1 in Google Cloud and use it for thousands of questions.

### 2. Ollama (Local LLM)
**Best for:** 100% offline privacy and sensitive data.
- **Pros:** Data never leaves your computer, no API costs, works offline.
- **Setup:** Install [Ollama](https://ollama.ai), pull a model (`ollama pull llama3.2`), and switch to Ollama in the app settings!

---

## 🎮 How to Use (Keyboard Shortcuts)

The app is entirely driven by hotkeys so you never have to break focus.

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Toggle the invisible window visibility |
| `Cmd/Ctrl + H` | **Take Screenshot** and instantly analyze it |
| `Cmd/Enter` | Get solution for typed prompt |
| `Cmd/Ctrl + Arrows` | Move the overlay window around your screen |

---

## 💡 Use Cases

### 👨‍💻 Tech & Development
> ✓ Debug error messages instantly via screenshot  
> ✓ Live technical interview coaching  
> ✓ Algorithm and architecture guidance without leaving your IDE  

### 📈 Professional Meetings
> ✓ Sales call preparation and objection handling  
> ✓ Client presentation support  
> ✓ Real-time fact-checking and data lookup via audio context  

### 🎓 Academic & Learning
> ✓ Live presentation support during classes  
> ✓ Quick research during online study sessions  
> ✓ Math and science problem solving  

---

## 🔧 Troubleshooting

- **Closing the App:** Press `Cmd + Q` (Mac) or `Ctrl + Q` (Windows/Linux) to quit, or use your Task Manager. The window "X" button is intentionally disabled to keep the app running invisibly.
- **Port 5180 in use:** If the app won't start, ensure no other process is using port 5180 (`lsof -i :5180` and `kill [PID]`).
- **Ollama Models not loading:** Ensure the Ollama app is actively running (`ollama serve`).

---

## 🤝 Contributing
This project welcomes contributions! 
- 🐛 Bug fixes and stability improvements
- ✨ New features and AI model integrations  
- 🎨 UI/UX enhancements

## 📄 License
ISC License - Free for personal and commercial use.

---

<div align="center">
  <strong>⭐ Star this repo if Wingman AI helps you succeed in your workflow!</strong>
</div>
