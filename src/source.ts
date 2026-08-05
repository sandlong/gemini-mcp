import path from 'node:path'

export function isRemoteSource(source: string): boolean {
  return /^https?:\/\//i.test(source)
}

export function resolveLocalSource(source: string, cwd: string = process.cwd()): string {
  return path.resolve(cwd, source)
}
