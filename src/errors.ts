export type ErrorStage = 'configuration' | 'filesystem' | 'upload' | 'processing' | 'interaction' | 'cleanup'

export class StageError extends Error {
  readonly stage: ErrorStage
  override readonly cause: unknown
  readonly warnings: string[]

  constructor(stage: ErrorStage, cause: unknown, warnings: string[] = []) {
    super(errorMessage(cause))
    this.name = 'StageError'
    this.stage = stage
    this.cause = cause
    this.warnings = warnings
  }
}

export interface SerializedToolError extends Record<string, unknown> {
  ok: false
  tool: string
  stage: ErrorStage
  model: string
  thinkingLevel: string
  message: string
  source?: string
  provider: 'gemini'
  status?: number
  code?: string | number
  details?: unknown
  warnings?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function firstNumber(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === 'number')
}

function firstCode(...values: unknown[]): string | number | undefined {
  return values.find((value): value is string | number => typeof value === 'string' || typeof value === 'number')
}

function toJsonSafe(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (depth >= 4) return String(value)
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => toJsonSafe(item, depth + 1))

  if (isRecord(value)) {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      if (key === 'stack') continue
      output[key] = toJsonSafe(item, depth + 1)
    }
    return output
  }

  return String(value)
}

export function serializeToolError(params: {
  error: unknown
  tool: string
  model: string
  thinkingLevel: string
  source?: string
  defaultStage?: ErrorStage
  warnings?: string[]
}): SerializedToolError {
  const stageError = params.error instanceof StageError ? params.error : undefined
  const underlying = stageError?.cause ?? params.error
  const record = isRecord(underlying) ? underlying : undefined
  const nested = isRecord(record?.error) ? record.error : undefined

  const result: SerializedToolError = {
    ok: false,
    tool: params.tool,
    stage: stageError?.stage ?? params.defaultStage ?? 'interaction',
    model: params.model,
    thinkingLevel: params.thinkingLevel,
    message: errorMessage(underlying),
    provider: 'gemini',
  }

  if (params.source) result.source = params.source

  const status = firstNumber(record?.status, record?.statusCode, nested?.code)
  if (status !== undefined) result.status = status

  const code = firstCode(record?.code, nested?.status, nested?.code)
  if (code !== undefined) result.code = code

  const details = record?.details ?? nested?.details ?? record?.errorDetails
  if (details !== undefined) result.details = toJsonSafe(details)
  const warnings = [...(stageError?.warnings ?? []), ...(params.warnings ?? [])]
  if (warnings.length > 0) result.warnings = warnings

  return result
}
