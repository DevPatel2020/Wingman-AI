# Wingman AI Setup Guide - Manual Steps

This guide lists what **YOU need to do manually** to set up Wingman AI. Everything else has been automated.

## ✅ What's Already Done (Automated)

- ✅ Project structure is set up
- ✅ Dependencies are configured
- ✅ Environment variable system is ready
- ✅ `env.example` template created
- ✅ Code is ready to run

## 📋 What You Need to Do Manually

### Step 1: Install Dependencies

**Run this command in the project directory:**

```bash
cd "Wingman AI"
npm install
```

**If you encounter Sharp/Python build errors, use this instead:**

```bash
cd "Wingman AI"
set SHARP_IGNORE_GLOBAL_LIBVIPS=1
npm install --ignore-scripts
npm rebuild sharp
```

### Step 2: Choose Your AI Provider

You have two options:

#### Option A: Google Gemini (Cloud AI) 🌐

**Pros:**
- Latest AI technology
- Fastest responses
- Best accuracy

**Steps:**
1. Get a Gemini API key:
   - Visit: https://makersuite.google.com/app/apikey
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy your API key

2. Create `.env` file:
   - Copy `env.example` to `.env` in the project directory (or create `.env` manually)
   - Replace `your_gemini_api_key_here` with your actual API key
   - Set `USE_OLLAMA=false`

**Example `.env` file:**
```env
GEMINI_API_KEY=AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
USE_OLLAMA=false
```

#### Option B: Ollama (Local/Private AI) 🔒

**Pros:**
- 100% private - data never leaves your computer
- No API costs
- Works offline

**Steps:**
1. Install Ollama:
   - Visit: https://ollama.ai
   - Download and install Ollama for Windows
   - Make sure Ollama is running (it should start automatically)

2. Pull a model:
   - Open Command Prompt or PowerShell
   - Run: `ollama pull llama3.2`
   - Wait for the download to complete (this may take a while, ~2-4GB)

3. Create `.env` file:
   - Copy `env.example` to `.env` in the project directory (or create `.env` manually)
   - Set `USE_OLLAMA=true`
   - Optionally set `OLLAMA_MODEL` (default: llama3.2)
   - You can leave `GEMINI_API_KEY` empty or remove it

**Example `.env` file:**
```env
USE_OLLAMA=true
OLLAMA_MODEL=llama3.2
OLLAMA_URL=http://localhost:11434
```

### Step 3: Run the Application

**For Development (Recommended for first run):**

```bash
cd "Wingman AI"
npm start
```

This will:
- Start the Vite dev server on port 5180
- Launch the Electron app automatically

**For Production Build:**

```bash
cd "Wingman AI"
npm run dist
```

The built app will be in the `release` folder.

## 🔧 Troubleshooting

### Port 5180 Already in Use

If you get an error about port 5180 being in use:

**Windows:**
```bash
# Find the process using port 5180
netstat -ano | findstr :5180

# Kill the process (replace PID with the number from above)
taskkill /PID <PID> /F
```

### Ollama Not Working

1. Make sure Ollama is running:
   - Check if Ollama service is running in Task Manager
   - Or run `ollama serve` in a terminal

2. Test Ollama:
   ```bash
   ollama list
   ollama run llama3.2
   ```

3. Check your `.env` file has `USE_OLLAMA=true`

### Gemini API Key Issues

1. Make sure your API key is correct
2. Check if you have API quota/billing set up in Google Cloud
3. Verify the key is not expired or revoked

### Sharp/Python Build Errors

If you see Python-related errors during installation:

```bash
# Use prebuilt binaries (recommended)
set SHARP_IGNORE_GLOBAL_LIBVIPS=1
npm install --ignore-scripts
npm rebuild sharp
```

## ⌨️ Keyboard Shortcuts

Once the app is running:

- `Ctrl + B`: Toggle window visibility
- `Ctrl + H`: Take screenshot
- `Ctrl + Enter`: Get solution
- `Ctrl + Arrow Keys`: Move window
- `Ctrl + Q`: Quit application

## 📝 Summary Checklist

- [ ] Run `npm install` in the project directory
- [ ] Choose AI provider (Gemini or Ollama)
- [ ] Get API key (if using Gemini) OR install Ollama (if using local AI)
- [ ] Create `.env` file from `env.example` (copy `env.example` to `.env`)
- [ ] Fill in your API key or Ollama settings
- [ ] Run `npm start` to launch the app
- [ ] Test the app with `Ctrl + H` to take a screenshot

## 🎉 You're All Set!

Once you complete these steps, Wingman AI will be ready to use. The app will start automatically when you run `npm start`.

---

**Need Help?**
- Check the main README.md for more details
- Review the troubleshooting section above
- Make sure all dependencies are installed correctly

