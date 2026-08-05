import { GoogleGenAI, type File, type Interactions } from '@google/genai'
import type { AppConfig } from './config.js'
import { StageError } from './errors.js'
import { isRemoteSource } from './source.js'
import { deleteUploadedFile, uploadLocalFile } from './uploads.js'

export type Modality = 'video' | 'audio' | 'document' | 'image'

export interface UnderstandingRequest {
  source: string
  prompt: string
  mimeType?: string
}

export interface ServiceResult {
  text: string
  interactionId: string
  warning?: string
}

export interface GeminiService {
  web(prompt: string): Promise<ServiceResult>
  understand(modality: Modality, request: UnderstandingRequest): Promise<ServiceResult>
}

export function buildMediaContent(
  modality: Modality,
  uri: string,
  mimeType?: string,
): Interactions.Content {
  const common = {
    type: modality,
    uri,
    ...(mimeType ? { mime_type: mimeType } : {}),
  }

  return common as Interactions.Content
}

export class GoogleGeminiService implements GeminiService {
  readonly client: GoogleGenAI
  readonly config: AppConfig

  constructor(config: AppConfig, client: GoogleGenAI = new GoogleGenAI({ apiKey: config.apiKey })) {
    this.config = config
    this.client = client
  }

  async web(prompt: string): Promise<ServiceResult> {
    try {
      const interaction = await this.client.interactions.create({
        model: this.config.model,
        input: prompt,
        tools: [{ type: 'google_search' }, { type: 'url_context' }],
        generation_config: {
          thinking_level: this.config.thinkingLevel,
        },
      })

      return {
        text: interaction.output_text ?? '',
        interactionId: interaction.id,
      }
    } catch (error) {
      throw new StageError('interaction', error)
    }
  }

  async understand(modality: Modality, request: UnderstandingRequest): Promise<ServiceResult> {
    if (isRemoteSource(request.source)) {
      return this.createUnderstandingInteraction(modality, request.source, request.prompt, request.mimeType)
    }

    let uploaded: File | undefined
    let warning: string | undefined
    let result: ServiceResult | undefined
    let primaryError: unknown

    try {
      uploaded = await uploadLocalFile(this.client, request.source, request.mimeType)
      if (!uploaded.uri) {
        throw new StageError('processing', new Error('Uploaded Gemini file has no URI'))
      }

      result = await this.createUnderstandingInteraction(
        modality,
        uploaded.uri,
        request.prompt,
        uploaded.mimeType ?? request.mimeType,
      )
    } catch (error) {
      primaryError = error
    } finally {
      if (uploaded) warning = await deleteUploadedFile(this.client, uploaded)
    }

    if (primaryError !== undefined) {
      if (warning) {
        if (primaryError instanceof StageError) {
          throw new StageError(primaryError.stage, primaryError.cause, [...primaryError.warnings, warning])
        }
        throw new StageError('interaction', primaryError, [warning])
      }
      throw primaryError
    }

    if (!result) {
      throw new StageError('interaction', new Error('Gemini returned no result'))
    }

    return warning ? { ...result, warning } : result
  }

  private async createUnderstandingInteraction(
    modality: Modality,
    uri: string,
    prompt: string,
    mimeType?: string,
  ): Promise<ServiceResult> {
    try {
      const interaction = await this.client.interactions.create({
        model: this.config.model,
        input: [buildMediaContent(modality, uri, mimeType), { type: 'text', text: prompt }],
        generation_config: {
          thinking_level: this.config.thinkingLevel,
        },
      })

      return {
        text: interaction.output_text ?? '',
        interactionId: interaction.id,
      }
    } catch (error) {
      throw new StageError('interaction', error)
    }
  }
}
