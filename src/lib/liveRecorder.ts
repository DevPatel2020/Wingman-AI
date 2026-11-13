// liveRecorder.ts
// Captures microphone (and optionally system/meeting audio), mixes them, and
// emits self-contained audio chunks every `chunkMs` for transcription.
//
// MediaRecorder's timeslice chunks are NOT independently decodable (only the
// first carries the WebM header), so instead we rotate: start a fresh recorder
// on the same stream, then stop the previous one. Each emitted blob is a
// complete file that any STT backend can decode on its own.

export interface AudioChunk {
  blob: Blob
  mimeType: string
  /** Offsets from recording start, in ms */
  startMs: number
  endMs: number
  /** Peak RMS level (0..1) observed during the chunk; used to skip silence */
  peakLevel: number
}

export interface LiveRecorderOptions {
  includeSystemAudio: boolean
  chunkMs?: number
  onChunk: (chunk: AudioChunk) => void
  onLevel?: (level: number) => void
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ""
}

export class LiveRecorder {
  private opts: Required<Omit<LiveRecorderOptions, "onLevel">> & Pick<LiveRecorderOptions, "onLevel">
  private streams: MediaStream[] = []
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private mixed: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private rotateTimer: number | null = null
  private levelTimer: number | null = null
  private startedAt = 0
  private chunkPeak = 0
  private mimeType = ""
  private pendingStops = new Set<Promise<void>>()
  private segments = new WeakMap<MediaRecorder, { parts: Blob[]; startMs: number }>()
  public systemAudioActive = false

  constructor(options: LiveRecorderOptions) {
    this.opts = { chunkMs: 10_000, ...options }
  }

  public async start(): Promise<void> {
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    })
    this.streams.push(mic)

    let system: MediaStream | null = null
    if (this.opts.includeSystemAudio) {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        display.getVideoTracks().forEach((t) => t.stop())
        if (display.getAudioTracks().length > 0) {
          system = new MediaStream(display.getAudioTracks())
          this.streams.push(display)
          this.systemAudioActive = true
        }
      } catch (err) {
        console.warn("[LiveRecorder] System audio unavailable, using microphone only:", err)
      }
    }

    // Mix sources into one stream and tap a level meter off the mix.
    this.audioContext = new AudioContext()
    const destination = this.audioContext.createMediaStreamDestination()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 1024
    for (const stream of [mic, system]) {
      if (!stream) continue
      const source = this.audioContext.createMediaStreamSource(stream)
      source.connect(destination)
      source.connect(this.analyser)
    }
    this.mixed = destination.stream
    this.mimeType = pickMimeType()
    this.startedAt = performance.now()

    this.startLevelMeter()
    this.startSegmentRecorder()
    this.rotateTimer = window.setInterval(() => this.rotate(), this.opts.chunkMs)
  }

  /** Stops capture, flushes the final chunk, and releases all devices. */
  public async stop(): Promise<void> {
    if (this.rotateTimer !== null) window.clearInterval(this.rotateTimer)
    this.rotateTimer = null
    const last = this.recorder
    this.recorder = null
    if (last) await this.stopRecorder(last, this.chunkPeak)
    await Promise.all(this.pendingStops)

    if (this.levelTimer !== null) window.clearInterval(this.levelTimer)
    this.levelTimer = null
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    this.streams = []
    await this.audioContext?.close().catch(() => undefined)
    this.audioContext = null
    this.opts.onLevel?.(0)
  }

  public elapsedMs(): number {
    return this.startedAt ? performance.now() - this.startedAt : 0
  }

  private rotate(): void {
    const previous = this.recorder
    const peak = this.chunkPeak // read before the new segment resets it
    this.startSegmentRecorder()
    if (previous) {
      const p = this.stopRecorder(previous, peak)
      this.pendingStops.add(p)
      p.finally(() => this.pendingStops.delete(p))
    }
  }

  private startSegmentRecorder(): void {
    if (!this.mixed) return
    const recorder = new MediaRecorder(this.mixed, this.mimeType ? { mimeType: this.mimeType } : undefined)
    const parts: Blob[] = []
    const startMs = this.elapsedMs()
    this.chunkPeak = 0
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) parts.push(e.data)
    }
    this.segments.set(recorder, { parts, startMs })
    recorder.start()
    this.recorder = recorder
  }

  private stopRecorder(recorder: MediaRecorder, peakLevel: number): Promise<void> {
    const { parts, startMs } = this.segments.get(recorder) ?? { parts: [], startMs: 0 }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || this.mimeType || "audio/webm"
        const blob = new Blob(parts, { type })
        if (blob.size > 0) {
          this.opts.onChunk({ blob, mimeType: type, startMs, endMs: this.elapsedMs(), peakLevel })
        }
        resolve()
      }
      if (recorder.state !== "inactive") recorder.stop()
      else resolve()
    })
  }

  private startLevelMeter(): void {
    const buffer = new Float32Array(1024)
    // setInterval (not rAF) so metering keeps working while the window is hidden.
    this.levelTimer = window.setInterval(() => {
      if (!this.analyser) return
      this.analyser.getFloatTimeDomainData(buffer)
      let sum = 0
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
      const rms = Math.sqrt(sum / buffer.length)
      if (rms > this.chunkPeak) this.chunkPeak = rms
      this.opts.onLevel?.(rms)
    }, 100)
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}
