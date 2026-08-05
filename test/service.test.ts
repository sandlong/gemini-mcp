import { describe, expect, it } from 'vitest'
import { buildMediaContent } from '../src/service.js'

describe('typed Gemini media inputs', () => {
  it('allows YouTube-style video input without a MIME type', () => {
    expect(buildMediaContent('video', 'https://www.youtube.com/watch?v=abc')).toEqual({
      type: 'video',
      uri: 'https://www.youtube.com/watch?v=abc',
    })
  })

  it('passes a caller-provided MIME type unchanged', () => {
    expect(buildMediaContent('image', 'https://example.com/image', 'image/webp')).toEqual({
      type: 'image',
      uri: 'https://example.com/image',
      mime_type: 'image/webp',
    })
  })
})
