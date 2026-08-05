import path from 'node:path'

export function resolveLocalSource(source: string, cwd: string = process.cwd()): string {
  return path.resolve(cwd, source)
}
