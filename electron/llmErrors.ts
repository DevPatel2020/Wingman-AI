type ProviderLabel = "Gemini" | "Ollama"

const PROVIDER_LABELS: Record<string, ProviderLabel> = {
  gemini: "Gemini",
  ollama: "Ollama"
}

export function providerLabel(provider: string): ProviderLabel {
  return PROVIDER_LABELS[provider] ?? "Gemini"
}

export function formatLlmError(error: unknown, provider: string): string {
  const raw =
    error instanceof Error ? error.message : String(error ?? "Unknown error")
  const label = providerLabel(provider)

  if (raw.includes("429") || raw.toLowerCase().includes("rate limit") || raw.includes("Resource exhausted")) {
    return `${label} rate limit reached. Wait a minute and try again, or switch to another provider in Models.`
  }
  if (raw.includes("403") || raw.toLowerCase().includes("forbidden")) {
    return `${label} access denied. Check API key permissions.`
  }
  if (raw.includes("401") || raw.toLowerCase().includes("unauthorized") || raw.includes("API key")) {
    return `${label} API key was rejected. Check your key in .env or paste it in Models → Apply.`
  }
  if (raw.includes("GoogleGenerativeAI")) {
    return raw.replace(/^GoogleGenerativeAIError:\s*/i, "Gemini: ")
  }
  if (raw.includes("Failed to connect to Ollama")) {
    return raw
  }
  return `${label}: ${raw}`
}
