import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, DEFAULT_THINKING_LEVEL, loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('uses the requested defaults', () => {
    expect(loadConfig({ GEMINI_API_KEY: 'key' })).toEqual({
      apiKey: 'key',
      model: DEFAULT_MODEL,
      thinkingLevel: DEFAULT_THINKING_LEVEL,
    })
  })

  it('accepts base URL, model, and thinking overrides', () => {
    expect(
      loadConfig({
        GEMINI_API_KEY: 'key',
        GEMINI_BASE_URL: ' https://proxy.example.test/gemini/ ',
        GEMINI_MODEL: 'custom-model',
        GEMINI_THINKING_LEVEL: 'low',
      }),
    ).toEqual({
      apiKey: 'key',
      baseUrl: 'https://proxy.example.test/gemini',
      model: 'custom-model',
      thinkingLevel: 'low',
    })
  })

  it('treats a blank base URL as the SDK default', () => {
    expect(loadConfig({ GEMINI_API_KEY: 'key', GEMINI_BASE_URL: '   ' }).baseUrl).toBeUndefined()
  })

  it('rejects an invalid base URL', () => {
    expect(() => loadConfig({ GEMINI_API_KEY: 'key', GEMINI_BASE_URL: 'not-a-url' })).toThrow(
      'GEMINI_BASE_URL must be a valid absolute URL',
    )
  })

  it('requires an API key', () => {
    expect(() => loadConfig({})).toThrow('GEMINI_API_KEY is required')
  })
})
