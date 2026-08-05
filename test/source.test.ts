import { describe, expect, it } from 'vitest'
import { isRemoteSource, resolveLocalSource } from '../src/source.js'

describe('source transport', () => {
  it('treats HTTP and HTTPS as remote', () => {
    expect(isRemoteSource('https://example.com/file.mp4')).toBe(true)
    expect(isRemoteSource('http://example.com/file.mp4')).toBe(true)
  })

  it('treats everything else as a local path', () => {
    expect(isRemoteSource('./file.mp4')).toBe(false)
    expect(isRemoteSource('/tmp/file.mp4')).toBe(false)
    expect(isRemoteSource('file:///tmp/file.mp4')).toBe(false)
  })

  it('resolves relative paths against the server working directory', () => {
    expect(resolveLocalSource('./file.pdf', '/workspace')).toBe('/workspace/file.pdf')
  })
})
