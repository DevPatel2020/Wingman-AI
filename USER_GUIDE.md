# Wingman AI User Guide - Features & How to Use

## 🎯 Overview

Wingman AI is an **open, consent-first desktop AI assistant** that helps you during meetings, lectures, study sessions and presentations. It sits on top of your other windows and provides real-time insights, answers, and support.

---

## ✨ Key Features

### 1. **📸 Smart Screenshot Analysis**
- Take screenshots of any content (problems, code, documents, presentations)
- AI automatically analyzes and extracts information
- Perfect for coding problems, meeting notes, or any visual content

### 2. **💬 AI Chat Interface**
- Chat directly with the AI about anything
- Automatic screenshot analysis when you take a screenshot
- Maintains conversation context
- Ask follow-up questions for deeper insights

### 3. **🎤 Voice/Audio Recording**
- Record audio clips and get AI analysis
- Perfect for meeting notes and voice input
- Real-time transcription and analysis

### 4. **🤖 Multiple AI Providers**
- **Google Gemini (Cloud)**: Fastest, most accurate, requires API key
- **Ollama (Local)**: 100% private, works offline, no API costs
- Switch between providers anytime

### 5. **🔍 Solution Generation & Debugging**
- Extract problem statements from screenshots
- Generate solutions with code
- Debug solutions with additional screenshots
- View time/space complexity analysis

### 6. **⚡ Global Keyboard Shortcuts**
- Work from anywhere in your system
- No need to click on the window
- Fast and efficient workflow

---

## 🎨 User Interface Overview

### **Main Window Layout**

The app has a **translucent, always-on-top window** with three main views:

#### **1. Queue View** (Default)
- Shows your screenshot queue (up to 5 screenshots)
- Chat interface (toggleable)
- Model selector settings
- Voice recording button
- Command bar with shortcuts

#### **2. Solutions View**
- Displays problem statement
- Shows AI-generated solution/analysis
- Code with syntax highlighting
- Complexity analysis
- Additional screenshot queue for debugging

#### **3. Debug View**
- Shows debugged solutions
- Comparison between original and fixed code
- Additional insights from debugging

---

## ⌨️ Keyboard Shortcuts

### **Global Shortcuts** (Work from anywhere)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl + B` (Windows)<br>`Cmd + B` (Mac) | Toggle Window | Show/hide the Wingman AI window |
| `Ctrl + H` (Windows)<br>`Cmd + H` (Mac) | Take Screenshot | Capture your screen (window hides temporarily) |
| `Ctrl + Enter` (Windows)<br>`Cmd + Enter` (Mac) | Solve/Debug | Process screenshots and generate solution |
| `Ctrl + R` (Windows)<br>`Cmd + R` (Mac) | Start Over | Clear everything and start fresh |
| `Ctrl + ←` | Move Window Left | Move window to the left |
| `Ctrl + →` | Move Window Right | Move window to the right |
| `Ctrl + ↑` | Move Window Up | Move window up |
| `Ctrl + ↓` | Move Window Down | Move window down |
| `Ctrl + Q` (Windows)<br>`Cmd + Q` (Mac) | Quit App | Close the application |

### **Note on Windows**
- Replace `Cmd` with `Ctrl` for all shortcuts
- The shortcuts work globally (even when the window is hidden)

---

## 🚀 How to Use Wingman AI

### **Basic Workflow**

#### **Step 1: Start the App**
```bash
npm start
```
The window will appear (you can hide it with `Ctrl + B`).

#### **Step 2: Take a Screenshot**
1. Navigate to the content you want to analyze (code, problem, document, etc.)
2. Press `Ctrl + H` (or `Cmd + H` on Mac)
3. The window will hide briefly, then reappear
4. Your screenshot is automatically analyzed!

#### **Step 3: View the Analysis**
- The AI automatically processes the screenshot
- Open the **Chat** (click 💬 Chat button) to see the analysis
- Or wait for it to appear in the Solutions view

#### **Step 4: Get Solutions (Optional)**
- If you have screenshots in the queue, press `Ctrl + Enter`
- The app will generate a solution based on your screenshots
- View the solution with code, analysis, and complexity

#### **Step 5: Debug (Optional)**
- Take more screenshots of your code or errors
- Press `Ctrl + Enter` again to debug
- The AI will analyze and provide fixes

---

## 📖 Detailed Feature Guide

### **1. Screenshot Analysis**

**How it works:**
1. Press `Ctrl + H` to take a screenshot
2. The window hides automatically (so it's not in the screenshot)
3. Screenshot is saved and analyzed
4. AI extracts information and provides insights

**Use cases:**
- Coding problems (LeetCode, HackerRank, etc.)
- Error messages
- Documentation
- Meeting slides
- Any visual content

**Tips:**
- Take multiple screenshots for complex problems
- The app saves up to 5 screenshots
- Screenshots are automatically analyzed when taken

---

### **2. AI Chat Interface**

**How to use:**
1. Click the **💬 Chat** button in the Queue view
2. Type your question or message
3. Press Enter or click Send
4. The AI responds with helpful insights

**Features:**
- Automatic screenshot analysis when you take a screenshot
- Conversation history maintained
- Works with both Gemini and Ollama
- Ask follow-up questions

**Example conversations:**
```
You: "Explain this code"
AI: [Analyzes the screenshot and explains]

You: "How can I optimize it?"
AI: [Provides optimization suggestions]

You: "What's the time complexity?"
AI: [Calculates and explains complexity]
```

---

### **3. Voice/Audio Recording**

**How to use:**
1. Click the **🎤 Record Voice** button
2. Speak into your microphone
3. Click again to stop recording
4. The AI analyzes your audio and provides insights

**Use cases:**
- Meeting notes
- Voice questions
- Audio transcription
- Quick voice input

**Note:** 
- Recording automatically stops after processing
- Audio is analyzed in real-time
- Works with both AI providers

---

### **4. Model Selection & Settings**

**How to switch AI providers:**
1. Click the **⚙️ Models** button
2. Choose between:
   - **☁️ Gemini (Cloud)**: Fast, accurate, requires API key
   - **🏠 Ollama (Local)**: Private, offline, no API key needed
3. Configure settings:
   - For Gemini: Enter API key (if updating)
   - For Ollama: Select model and URL
4. Click **Apply Changes**
5. Test connection with **Test** button

**Model Selection:**
- **Gemini**: Best for accuracy and speed
- **Ollama**: Best for privacy and offline use
- Switch anytime without restarting

**Available Ollama Models:**
- `llama3.2` (default, recommended)
- `codellama` (for coding)
- `mistral` (lightweight)
- Any Ollama-compatible model

---

### **5. Solution Generation**

**How it works:**
1. Take screenshots of your problem
2. Press `Ctrl + Enter` to process
3. The AI extracts the problem statement
4. Generates a solution with:
   - Code/Response
   - Analysis/Thoughts
   - Time complexity
   - Space complexity

**Solution View shows:**
- Problem statement
- AI analysis and reasoning
- Complete solution code
- Complexity analysis
- Additional screenshots for debugging

---

### **6. Debugging Mode**

**How to debug:**
1. Generate an initial solution
2. Take additional screenshots of:
   - Your code
   - Error messages
   - Test cases
   - Expected outputs
3. Press `Ctrl + Enter` again
4. The AI analyzes and provides fixes

**Debug View shows:**
- Original solution
- Debugged solution
- Differences highlighted
- Explanation of fixes

---

## 🎯 Use Cases & Examples

### **1. Coding Interview Practice**
```
1. Take screenshot of LeetCode problem
2. Press Ctrl + Enter
3. Get solution with explanation
4. Ask questions in chat
5. Debug your code if needed
```

### **2. Meeting Notes**
```
1. Take screenshot of meeting slides
2. Or record audio during meeting
3. Get AI summary and insights
4. Ask follow-up questions
```

### **3. Error Debugging**
```
1. Take screenshot of error message
2. Get AI explanation
3. Take screenshot of your code
4. Press Ctrl + Enter to debug
5. Get fixed code
```

### **4. Learning & Research**
```
1. Take screenshot of documentation
2. Ask questions in chat
3. Get detailed explanations
4. Request examples
```

---

## 💡 Pro Tips

1. **Hide the Window**: Press `Ctrl + B` to hide the window when not needed
2. **Multiple Screenshots**: Take multiple screenshots for complex problems
3. **Chat First**: Use chat for quick questions before taking screenshots
4. **Debug Mode**: Use debugging mode to fix errors in your code
5. **Switch Models**: Use Ollama for privacy, Gemini for speed
6. **Move Window**: Use arrow keys to reposition the window
7. **Start Fresh**: Press `Ctrl + R` to clear everything and start over

---

## 🔧 Troubleshooting

### **Window Not Showing**
- Press `Ctrl + B` to toggle visibility
- Check if window is behind other applications
- Use `Ctrl + Shift + Space` to center and show

### **Screenshots Not Working**
- Make sure you have screen capture permissions
- Check if another app is blocking screenshots
- Try restarting the app

### **AI Not Responding**
- Check your API key (for Gemini)
- Make sure Ollama is running (for Ollama)
- Test connection in Settings
- Check internet connection (for Gemini)

### **Audio Not Working**
- Grant microphone permissions
- Check if microphone is working
- Try restarting the app

---

## 🎨 UI Elements Explained

### **Command Bar**
- **Show/Hide**: Toggle window visibility
- **Solve**: Process screenshots (when available)
- **🎤 Record Voice**: Record audio
- **💬 Chat**: Open chat interface
- **⚙️ Models**: Open model selector
- **?**: Show keyboard shortcuts help
- **🚪 Quit**: Close the app

### **Screenshot Queue**
- Shows up to 5 latest screenshots
- Click X to delete a screenshot
- Screenshots are automatically analyzed

### **Chat Interface**
- Type messages and get AI responses
- Automatic screenshot analysis
- Conversation history
- Loading indicators

### **Solutions View**
- Problem statement
- AI analysis
- Code with syntax highlighting
- Complexity metrics
- Additional screenshots for debugging

---

## 📝 Quick Reference

### **Essential Shortcuts**
- `Ctrl + B`: Toggle window
- `Ctrl + H`: Take screenshot
- `Ctrl + Enter`: Solve/Debug
- `Ctrl + R`: Start over
- `Ctrl + Q`: Quit

### **Essential Buttons**
- 💬 Chat: Open chat
- 🎤 Record: Record audio
- ⚙️ Models: Switch AI provider
- ?: Help

### **Workflow**
1. Take screenshot (`Ctrl + H`)
2. View analysis (auto or in chat)
3. Get solution (`Ctrl + Enter`)
4. Debug if needed (more screenshots + `Ctrl + Enter`)
5. Start over (`Ctrl + R`)

---

## 🎉 You're Ready!

You now know how to use Wingman AI! Start by:
1. Taking a screenshot (`Ctrl + H`)
2. Opening the chat (💬 Chat button)
3. Asking questions or getting solutions

**Happy coding and learning! 🚀**

---

## 📚 Additional Resources

- **Setup Guide**: See `SETUP_GUIDE.md` for installation
- **Quick Start**: See `QUICK_START.md` for fast setup
- **README**: See `README.md` for technical details

---

**Need Help?**
- Check the troubleshooting section above
- Review keyboard shortcuts
- Test your AI connection in Settings
- Make sure permissions are granted

