import { access } from 'node:fs/promises'
import { FileState, type File, type GoogleGenAI } from '@google/genai'
import { StageError } from './errors.js'
import { resolveLocalSource } from './source.js'

const POLL_INTERVAL_MS = 5_000
const PROCESSING_TIMEOUT_MS = 10 * 60_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function uploadLocalFile(
  client: GoogleGenAI,
  source: string,
  mimeType?: string,
): Promise<File> {
  const filePath = resolveLocalSource(source)

  try {
    await access(filePath)
  } catch (error) {
    throw new StageError('filesystem', error)
  }

  let uploaded: File
  try {
    uploaded = await client.files.upload({
      file: filePath,
      ...(mimeType ? { config: { mimeType } } : {}),
    })
  } catch (error) {
    throw new StageError('upload', error)
  }

  return waitUntilActive(client, uploaded)
}

export async function waitUntilActive(client: GoogleGenAI, initialFile: File): Promise<File> {
  let file = initialFile
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS

  while (true) {
    if (!file.state || file.state === FileState.ACTIVE) return file

    if (file.state === FileState.FAILED) {
      throw new StageError('processing', file.error ?? new Error('Gemini file processing failed'))
    }

    if (file.state !== FileState.PROCESSING) {
      throw new StageError('processing', new Error(`Unexpected Gemini file state: ${file.state}`))
    }

    if (Date.now() >= deadline) {
      throw new StageError('processing', new Error('Timed out waiting for Gemini file processing'))
    }

    if (!file.name) {
      throw new StageError('processing', new Error('Uploaded Gemini file has no resource name'))
    }

    await sleep(POLL_INTERVAL_MS)

    try {
      file = await client.files.get({ name: file.name })
    } catch (error) {
      throw new StageError('processing', error)
    }
  }
}

export async function deleteUploadedFile(client: GoogleGenAI, file: File): Promise<string | undefined> {
  if (!file.name) return 'Uploaded file had no resource name and could not be deleted'

  try {
    await client.files.delete({ name: file.name })
    return undefined
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Failed to delete temporary Gemini upload ${file.name}: ${message}`
  }
}
