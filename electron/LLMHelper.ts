import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"
import { envString, loadEnv } from "./env"
import { formatLlmError } from "./llmErrors"

interface OllamaResponse {
  response: string
  done: boolean
}

type LLMProvider = "gemini" | "ollama"

export class LLMHelper {
  private model: GenerativeModel | null = null
  private readonly systemPrompt = `You are Wingman AI, a helpful, proactive assistant for any kind of problem or situation (not just coding). For any user input, analyze the situation, provide a clear problem statement, relevant context, and suggest several possible responses or actions the user could take next. Always explain your reasoning. Present your suggestions as a list of options or next steps.`
  
  // Ollama config
  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2:latest"
  private ollamaUrl: string = "http://localhost:11434"

  constructor(
    apiKey?: string,
    useOllama: boolean = false,
    ollamaModel?: string,
    ollamaUrl?: string
  ) {
    this.useOllama = useOllama

    if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://localhost:11434"
      this.ollamaModel = ollamaModel || "llama3.2:latest"
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)
      this.initializeOllamaModel()
    } else if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      this.model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })
      console.log("[LLMHelper] Using Google Gemini (gemini-2.5-flash-lite)")
    } else {
      throw new Error("No LLM provider configured. Set GEMINI_API_KEY or enable Ollama.")
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async fileToGenerativePart(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath)
    return {
      inlineData: {
        data: imageData.toString("base64"),
        mimeType: "image/png"
      }
    }
  }

  private cleanJsonResponse(text: string): string {
    text = text.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "")
    return text.trim()
  }

  // ─── Ollama ─────────────────────────────────────────────────────────────────

  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt,
          stream: false,
          options: { temperature: 0.7, top_p: 0.9 }
        })
      })
      if (!response.ok) throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      const data: OllamaResponse = await response.json()
      return data.response
    } catch (error: any) {
      console.error("[LLMHelper] Error calling Ollama:", error)
      throw new Error(`Failed to connect to Ollama: ${error.message}. Make sure Ollama is running on ${this.ollamaUrl}`)
    }
  }

  private async checkOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }

  private async initializeOllamaModel(): Promise<void> {
    try {
      const availableModels = await this.getOllamaModels()
      if (availableModels.length === 0) {
        console.warn("[LLMHelper] No Ollama models found")
        return
      }
      if (!availableModels.includes(this.ollamaModel)) {
        this.ollamaModel = availableModels[0]
        console.log(`[LLMHelper] Auto-selected first available model: ${this.ollamaModel}`)
      }
      await this.callOllama("Hello")
      console.log(`[LLMHelper] Successfully initialized with model: ${this.ollamaModel}`)
    } catch (error: any) {
      console.error(`[LLMHelper] Failed to initialize Ollama model: ${error.message}`)
      try {
        const models = await this.getOllamaModels()
        if (models.length > 0) {
          this.ollamaModel = models[0]
          console.log(`[LLMHelper] Fallback to: ${this.ollamaModel}`)
        }
      } catch (fallbackError: any) {
        console.error(`[LLMHelper] Fallback also failed: ${fallbackError.message}`)
      }
    }
  }

  // ─── Retry ──────────────────────────────────────────────────────────────────

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: any) {
        const isRateLimit =
          error?.message?.includes("429") ||
          error?.message?.includes("rate_limit") ||
          error?.status === 429
        const isLastAttempt = attempt === maxRetries - 1

        if (isRateLimit && !isLastAttempt) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.log(`Rate limit hit. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw error
      }
    }
    throw new Error("Max retries exceeded")
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Please analyze these images and extract the following information in JSON format:\n{\n  "problem_statement": "A clear statement of the problem or situation depicted in the images.",\n  "context": "Relevant background or context from the images.",\n  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],\n  "reasoning": "Explanation of why these suggestions are appropriate."\n}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      if (!this.model) throw new Error("Gemini model not initialized. Check your API key.")
      const imageParts = await Promise.all(imagePaths.map(p => this.fileToGenerativePart(p)))
      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      return JSON.parse(this.cleanJsonResponse(response.text()))
    } catch (error) {
      console.error("Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `${this.systemPrompt}\n\nGiven this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nPlease provide your response in the following JSON format:\n{\n  "solution": {\n    "code": "The code or main answer here.",\n    "problem_statement": "Restate the problem or situation.",\n    "context": "Relevant background/context.",\n    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],\n    "reasoning": "Explanation of why these suggestions are appropriate."\n  }\n}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

    console.log("[LLMHelper] Calling LLM for solution...")
    try {
      if (!this.model) throw new Error("Gemini model not initialized. Check your API key.")
      const result = await this.model.generateContent(prompt)
      console.log("[LLMHelper] Gemini LLM returned result.")
      const response = await result.response
      const parsed = JSON.parse(this.cleanJsonResponse(response.text()))
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error)
      throw error
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{\n  "solution": {\n    "code": "The code or main answer here.",\n    "problem_statement": "Restate the problem or situation.",\n    "context": "Relevant background/context.",\n    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],\n    "reasoning": "Explanation of why these suggestions are appropriate."\n  }\n}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      if (!this.model) throw new Error("Gemini model not initialized. Check your API key.")
      const imageParts = await Promise.all(debugImagePaths.map(p => this.fileToGenerativePart(p)))
      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const parsed = JSON.parse(this.cleanJsonResponse(response.text()))
      console.log("[LLMHelper] Parsed debug LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("Error debugging solution with images:", error)
      throw error
    }
  }

  public async analyzeAudioFile(audioPath: string) {
    try {
      const audioData = await fs.promises.readFile(audioPath)
      const audioPart = {
        inlineData: {
          data: audioData.toString("base64"),
          mimeType: "audio/mp3"
        }
      }
      const prompt = this.buildAudioPrompt()
      const result = await this.retryWithBackoff(async () => {
        if (!this.model) throw new Error("Gemini model not initialized. Check your API key.")
        return await this.model.generateContent([prompt, audioPart])
      })
      const response = await result.response
      return { text: response.text(), timestamp: Date.now() }
    } catch (error: any) {
      console.error("Error analyzing audio file:", error)
      throw this.wrapApiError(error)
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    try {
      const audioPart = { inlineData: { data, mimeType } }
      const prompt = this.buildAudioPrompt()
      const result = await this.retryWithBackoff(async () => {
        if (!this.model) throw new Error("Gemini model not initialized. Check your API key.")
        return await this.model.generateContent([prompt, audioPart])
      })
      const response = await result.response
      return { text: response.text(), timestamp: Date.now() }
    } catch (error: any) {
      console.error("Error analyzing audio from base64:", error)
      throw this.wrapApiError(error)
    }
  }

  public async analyzeImageFile(imagePath: string) {
    try {
      const imageData = await fs.promises.readFile(imagePath)
      const base64 = imageData.toString("base64")
      const prompt = `${this.systemPrompt}\n\nDescribe the content of this image in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the image. Do not return a structured JSON object, just answer naturally as you would to a user. Be concise and brief.`

      if (!this.model) throw new Error("Gemini model not initialized. Check your API key.")
      const imagePart = { inlineData: { data: base64, mimeType: "image/png" } }
      const result = await this.retryWithBackoff(async () => {
        if (!this.model) throw new Error("Gemini model not initialized.")
        return await this.model.generateContent([prompt, imagePart])
      })
      const response = await result.response
      return { text: response.text(), timestamp: Date.now() }
    } catch (error: any) {
      console.error("Error analyzing image file:", error)
      throw new Error(formatLlmError(error, this.getCurrentProvider()))
    }
  }

  public async chatWithGemini(message: string): Promise<string> {
    try {
      if (this.useOllama) {
        return this.callOllama(message)
      }

      if (this.model) {
        const enhancedPrompt = `${message}\n\nPlease format your response with proper line breaks, paragraphs, and structure. Use clear headings, bullet points, and code blocks where appropriate. Make it easy to read and understand.`
        const result = await this.retryWithBackoff(async () => {
          if (!this.model) throw new Error("Gemini model not initialized. Check your API key.")
          return await this.model.generateContent(enhancedPrompt)
        })
        const response = await result.response
        return response.text()
      }

      throw new Error("No LLM provider configured")
    } catch (error: any) {
      console.error("[LLMHelper] Error in chat:", error)
      throw new Error(formatLlmError(error, this.getCurrentProvider()))
    }
  }

  public async chat(message: string): Promise<string> {
    return this.chatWithGemini(message)
  }

  // ─── Provider management ────────────────────────────────────────────────────

  public getCurrentProvider(): LLMProvider {
    if (this.useOllama) return "ollama"
    return "gemini"
  }

  public getCurrentModel(): string {
    if (this.useOllama) return this.ollamaModel
    return "gemini-2.5-flash-lite"
  }

  public isUsingOllama(): boolean {
    return this.useOllama
  }

  public async getOllamaModels(): Promise<string[]> {
    try {
      const url = this.ollamaUrl || envString("OLLAMA_URL") || "http://localhost:11434"
      const response = await fetch(`${url}/api/tags`)
      if (!response.ok) throw new Error("Failed to fetch models")
      const data = await response.json()
      return data.models?.map((model: any) => model.name) || []
    } catch (error) {
      console.error("[LLMHelper] Error fetching Ollama models:", error)
      return []
    }
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    this.useOllama = true
    if (url) this.ollamaUrl = url
    if (model) {
      this.ollamaModel = model
    } else {
      await this.initializeOllamaModel()
    }
    console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaModel} at ${this.ollamaUrl}`)
  }

  public async switchToGemini(apiKey?: string): Promise<void> {
    loadEnv()
    const key = apiKey?.trim() || envString("GEMINI_API_KEY")
    if (!key) {
      throw new Error(
        "No Gemini API key. Add GEMINI_API_KEY to .env in the free-cluely folder, or paste your key in Models."
      )
    }
    const genAI = new GoogleGenerativeAI(key)
    this.model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })
    this.useOllama = false
    console.log("[LLMHelper] Switched to Gemini")
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.useOllama) {
        const available = await this.checkOllamaAvailable()
        if (!available) return { success: false, error: `Ollama not available at ${this.ollamaUrl}` }
        await this.callOllama("Hello")
        return { success: true }
      }
      if (!this.model) return { success: false, error: "No Gemini model configured" }
      const result = await this.model.generateContent("Hello")
      const response = await result.response
      return response.text() ? { success: true } : { success: false, error: "Empty response from Gemini" }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildAudioPrompt(): string {
    return `${this.systemPrompt}

**Audio Analysis Request:**

Please provide a comprehensive and informative analysis of this audio clip. Provide detailed explanations, especially for educational questions or topics:

**Main Content:**
- Transcribe and provide a detailed summary of the key points discussed
- Identify the main topic or subject matter
- Extract and explain important facts, figures, or data mentioned
- Address any questions raised with thorough explanations
- For educational topics, provide clear explanations and context

**Detailed Explanation:**
- Provide in-depth explanations of concepts mentioned
- Explain technical terms, processes, or methods in detail
- If this is an educational question, provide comprehensive answers with examples
- Include relevant background information and context
- Break down complex topics into understandable parts

**Key Takeaways:**
- List the most important points or insights
- Highlight any decisions, conclusions, or agreements reached
- Identify action items or next steps mentioned

**Next Steps:**
- Suggest relevant actions or follow-up questions
- Provide recommendations based on the content

Please provide a well-structured, comprehensive response.`
  }

  private wrapApiError(error: any): Error {
    if (error?.message?.includes("Audio analysis is not supported")) return error
    if (error?.message?.includes("429") || error?.status === 429) {
      return new Error("API rate limit exceeded. Please wait a moment and try again. Consider switching to Ollama for unlimited usage.")
    } else if (error?.message?.includes("401") || error?.status === 401) {
      return new Error("Invalid API key. Please check your API key in the .env file.")
    } else if (error?.message?.includes("403") || error?.status === 403) {
      return new Error("API access denied. Please check your API key permissions.")
    }
    return new Error(`Audio analysis failed: ${error?.message || "Unknown error"}. Please try again.`)
  }
}