import { describe, expect, it } from 'vitest'
import { resolveLocalSource } from '../src/source.js'

describe('source transport', () => {
  it('resolves relative paths against the server working directory', () => {
    expect(resolveLocalSource('./file.pdf', '/workspace')).toBe('/workspace/file.pdf')
  })
})
