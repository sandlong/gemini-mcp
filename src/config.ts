export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_THINKING_LEVEL = 'high'

export interface AppConfig {
  apiKey: string
  baseUrl?: string
  model: string
  thinkingLevel: string
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const baseUrl = value?.trim()
  if (!baseUrl) return undefined

  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error('GEMINI_BASE_URL must be a valid absolute URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('GEMINI_BASE_URL must use http or https')
  }

  return baseUrl.replace(/\/+$/, '')
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required')
  }

  const baseUrl = normalizeBaseUrl(env.GEMINI_BASE_URL)

  return {
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    model: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    thinkingLevel: env.GEMINI_THINKING_LEVEL?.trim() || DEFAULT_THINKING_LEVEL,
  }
}
