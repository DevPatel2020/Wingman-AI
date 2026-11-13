# Quick Start - What You Need to Do

## 🚀 Quick Setup (3 Steps)

### 1. Install Dependencies
```bash
cd "Wingman AI"
npm install
```

### 2. Set Up API Key

**Choose ONE option:**

**Option A - Gemini (Cloud):**
1. Get API key: https://aistudio.google.com/app/apikey
2. Create `.env` file:
   ```env
   GEMINI_API_KEY=your_key_here
   USE_OLLAMA=false
   ```

**Option B - Ollama (Local):**
1. Install Ollama: https://ollama.ai
2. Run: `ollama pull llama3.2`
3. Create `.env` file:
   ```env
   USE_OLLAMA=true
   OLLAMA_MODEL=llama3.2
   ```

### 3. Run the App
```bash
npm start
```

## 📋 Full Instructions

See `SETUP_GUIDE.md` for detailed instructions and `README.md` for features (Notes, Memory, Study, Practice).

## ⌨️ Keyboard Shortcuts

- `Ctrl + B`: Toggle window
- `Ctrl + H`: Take screenshot
- `Ctrl + Enter`: Get solution
- `Ctrl + Q`: Quit

---

**That's it!** The app will launch automatically after `npm start`.

