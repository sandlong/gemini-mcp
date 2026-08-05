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

  it('accepts model and thinking overrides', () => {
    expect(
      loadConfig({
        GEMINI_API_KEY: 'key',
        GEMINI_MODEL: 'custom-model',
        GEMINI_THINKING_LEVEL: 'low',
      }),
    ).toEqual({
      apiKey: 'key',
      model: 'custom-model',
      thinkingLevel: 'low',
    })
  })

  it('requires an API key', () => {
    expect(() => loadConfig({})).toThrow('GEMINI_API_KEY is required')
  })
})
