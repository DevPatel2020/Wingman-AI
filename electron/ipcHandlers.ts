// ipcHandlers.ts

import { ipcMain, app, dialog, BrowserWindow } from "electron"
import fs from "fs"
import { AudioSource } from "./TranscriptStore"
import { AppState } from "./main"
import { getLoadedEnvPath, loadEnv } from "./env"
import { formatLlmError } from "./llmErrors"
import { initializeFeatureIpc } from "./featureIpc"

export function initializeIpcHandlers(appState: AppState): void {
  initializeFeatureIpc(appState)

  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("get-screenshots", async () => {
    console.log({ view: appState.getView() })
    try {
      let previews = []
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      }
      previews.forEach((preview: any) => console.log(preview.path))
      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues()
      console.log("Screenshot queues have been cleared.")
      return { success: true }
    } catch (error: any) {
      console.error("Error resetting queues:", error)
      return { success: false, error: error.message }
    }
  })

  // IPC handler for analyzing audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string) => {
    try {
      const result = await appState.processingHelper.processAudioBase64(data, mimeType)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.processAudioFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      const llm = appState.processingHelper.getLLMHelper()
      return await llm.analyzeImageFile(path)
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error)
      const llm = appState.processingHelper.getLLMHelper()
      throw new Error(formatLlmError(error, llm.getCurrentProvider()))
    }
  })

  ipcMain.handle("gemini-chat", async (event, message: string) => {
    try {
      const llm = appState.processingHelper.getLLMHelper()
      return await llm.chatWithGemini(message)
    } catch (error: any) {
      console.error("Error in chat handler:", error)
      const llm = appState.processingHelper.getLLMHelper()
      throw new Error(formatLlmError(error, llm.getCurrentProvider()))
    }
  });

  // ─── Live transcription ──────────────────────────────────────────────────
  // Chunks for a session are transcribed one at a time, in arrival order, so
  // the transcript stays ordered and we never flood the STT backend.
  const sessionQueues = new Map<string, Promise<unknown>>()

  ipcMain.handle(
    "transcript:start",
    async (_event, opts: { title?: string; consentConfirmed: boolean; source: AudioSource }) => {
      if (opts?.consentConfirmed !== true) {
        throw new Error("Recording requires confirming that all participants have been informed.")
      }
      const session = appState.transcriptStore.start({
        title: opts.title,
        source: opts.source === "mic+system" ? "mic+system" : "mic",
        backend: appState.transcriptionService.describeBackend()
      })
      sessionQueues.set(session.id, Promise.resolve())
      appState.setRecording(true)
      return { sessionId: session.id, title: session.title, backend: session.backend }
    }
  )

  ipcMain.handle(
    "transcript:chunk",
    async (
      _event,
      chunk: { sessionId: string; data: string; mimeType: string; startMs: number; endMs: number }
    ) => {
      const session = appState.transcriptStore.get(chunk.sessionId)
      const previous = sessionQueues.get(chunk.sessionId) ?? Promise.resolve()
      const job = previous
        .catch((): void => undefined)
        .then(async () => {
          const text = await appState.transcriptionService.transcribe(
            Buffer.from(chunk.data, "base64"),
            chunk.mimeType
          )
          if (!text) return null
          return appState.transcriptStore.append(chunk.sessionId, {
            startMs: chunk.startMs,
            endMs: chunk.endMs,
            text,
            source: session.source
          })
        })
      sessionQueues.set(chunk.sessionId, job)
      try {
        return await job
      } catch (error: any) {
        const llm = appState.processingHelper.getLLMHelper()
        throw new Error(formatLlmError(error, llm.getCurrentProvider()))
      }
    }
  )

  ipcMain.handle("transcript:stop", async (_event, sessionId: string) => {
    await (sessionQueues.get(sessionId) ?? Promise.resolve()).catch((): void => undefined)
    sessionQueues.delete(sessionId)
    appState.setRecording(false)
    const session = appState.transcriptStore.stop(sessionId)
    // Add the finished session to meeting memory so it becomes searchable.
    let memoryWarning: string | undefined
    if (session.segments.length > 0) {
      try {
        memoryWarning = (await appState.memoryStore.indexSession(session)).warning
      } catch (error: any) {
        memoryWarning = `Could not add this session to memory: ${error?.message ?? error}`
      }
    }
    return { sessionId: session.id, segmentCount: session.segments.length, memoryWarning }
  })

  ipcMain.handle("transcript:summarize", async (_event, sessionId: string) => {
    const store = appState.transcriptStore
    const session = store.get(sessionId)
    if (session.segments.length === 0) throw new Error("Nothing has been transcribed yet.")
    const summary = await appState.processingHelper
      .getLLMHelper()
      .summarizeTranscript(store.toPlainText(session))
    store.setSummary(sessionId, summary)
    // Re-index so the notes become searchable too (ignore failures; transcript is already indexed).
    if (session.endedAt) appState.memoryStore.indexSession(session).catch((): void => undefined)
    return summary
  })

  ipcMain.handle("transcript:get-markdown", async (_event, sessionId: string) => {
    const store = appState.transcriptStore
    return store.toMarkdown(store.get(sessionId))
  })

  ipcMain.handle("transcript:export", async (event, sessionId: string) => {
    const store = appState.transcriptStore
    const session = store.get(sessionId)
    const safeTitle = session.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "meeting-notes"
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.SaveDialogOptions = {
      title: "Export meeting notes",
      defaultPath: `${safeTitle}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }]
    }
    // Cast: a stale @types/electron in devDependencies shadows Electron 33's
    // own typings with the old callback-style signature.
    const showSaveDialog = dialog.showSaveDialog as unknown as (
      ...args: unknown[]
    ) => Promise<Electron.SaveDialogReturnValue>
    const result = win ? await showSaveDialog(win, options) : await showSaveDialog(options)
    if (result.canceled || !result.filePath) return { saved: false }
    await fs.promises.writeFile(result.filePath, store.toMarkdown(session), "utf-8")
    return { saved: true, path: result.filePath }
  })

  ipcMain.handle("transcript:backend", async () => {
    return appState.transcriptionService.describeBackend()
  })

  ipcMain.handle("quit-app", () => {
    app.quit()
  })

  // Window movement handlers
  ipcMain.handle("move-window-left", async () => {
    appState.moveWindowLeft()
  })

  ipcMain.handle("move-window-right", async () => {
    appState.moveWindowRight()
  })

  ipcMain.handle("move-window-up", async () => {
    appState.moveWindowUp()
  })

  ipcMain.handle("move-window-down", async () => {
    appState.moveWindowDown()
  })

  ipcMain.handle("center-and-show-window", async () => {
    appState.centerAndShowWindow()
  })

  // LLM Model Management Handlers
  ipcMain.handle("get-current-llm-config", async () => {
    try {
      loadEnv()
      const llmHelper = appState.processingHelper.getLLMHelper();
      return {
        provider: llmHelper.getCurrentProvider(),
        model: llmHelper.getCurrentModel(),
        isOllama: llmHelper.isUsingOllama(),
        envPath: getLoadedEnvPath() ?? undefined
      };
    } catch (error: any) {
      console.error("Error getting current LLM config:", error);
      throw error;
    }
  });

  ipcMain.handle("get-available-ollama-models", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      const models = await llmHelper.getOllamaModels();
      return models;
    } catch (error: any) {
      console.error("Error getting Ollama models:", error);
      throw error;
    }
  });

  ipcMain.handle("switch-to-ollama", async (_, model?: string, url?: string) => {
    try {
      loadEnv()
      const llmHelper = appState.processingHelper.getLLMHelper();
      await llmHelper.switchToOllama(model, url);
      return { success: true, provider: llmHelper.getCurrentProvider(), model: llmHelper.getCurrentModel() };
    } catch (error: any) {
      console.error("Error switching to Ollama:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("switch-to-gemini", async (_, apiKey?: string) => {
    try {
      loadEnv()
      const llmHelper = appState.processingHelper.getLLMHelper();
      await llmHelper.switchToGemini(apiKey);
      return { success: true, provider: llmHelper.getCurrentProvider(), model: llmHelper.getCurrentModel() };
    } catch (error: any) {
      console.error("Error switching to Gemini:", error);
      return { success: false, error: error.message };
    }
  });


  ipcMain.handle("test-llm-connection", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      const result = await llmHelper.testConnection();
      return result;
    } catch (error: any) {
      console.error("Error testing LLM connection:", error);
      return { success: false, error: error.message };
    }
  });
}
