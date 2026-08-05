export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_THINKING_LEVEL = 'high'

export interface AppConfig {
  apiKey: string
  model: string
  thinkingLevel: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required')
  }

  return {
    apiKey,
    model: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    thinkingLevel: env.GEMINI_THINKING_LEVEL?.trim() || DEFAULT_THINKING_LEVEL,
  }
}
