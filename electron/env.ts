import fs from "fs"
import path from "path"
import dotenv from "dotenv"

let loadedEnvPath: string | null = null

/** Resolve .env from app root even when cwd is the parent Cluely folder. */
export function loadEnv(): string {
  const candidates = [
    path.resolve(__dirname, "..", ".env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "free-cluely", ".env")
  ]

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true })
      loadedEnvPath = envPath
      return envPath
    }
  }

  dotenv.config()
  loadedEnvPath = candidates[0]
  return loadedEnvPath
}

export function getLoadedEnvPath(): string | null {
  return loadedEnvPath
}

export function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  return value === "true" || value === "1" || value === "yes"
}

export function envString(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}
