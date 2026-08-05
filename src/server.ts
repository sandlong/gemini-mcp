import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { AppConfig } from './config.js'
import { serializeToolError } from './errors.js'
import type { GeminiService, Modality, ServiceResult } from './service.js'

const understandingInputSchema = {
  source: z
    .string()
    .min(1)
    .describe('A local filesystem path or public HTTP(S) URL. The local path is resolved on the MCP server.'),
  prompt: z.string().min(1).describe('What Gemini should determine, describe, extract, or summarize.'),
  mimeType: z
    .string()
    .min(1)
    .optional()
    .describe('Optional MIME type hint. Usually omit for YouTube and local files; provide it for direct remote files.'),
}

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const

function successResult(result: ServiceResult, model: string, thinkingLevel: string) {
  const structuredContent = {
    ok: true,
    text: result.text,
    interactionId: result.interactionId,
    model,
    thinkingLevel,
    ...(result.warning ? { warning: result.warning } : {}),
  }

  return {
    content: [{ type: 'text' as const, text: result.text }],
    structuredContent,
  }
}

function registerUnderstandingTool(
  server: McpServer,
  service: GeminiService,
  config: AppConfig,
  modality: Modality,
  description: string,
): void {
  server.registerTool(
    modality,
    {
      title: `Gemini ${modality} understanding`,
      description,
      inputSchema: understandingInputSchema,
      annotations,
    },
    async ({ source, prompt, mimeType }) => {
      try {
        const result = await service.understand(modality, {
          source,
          prompt,
          ...(mimeType ? { mimeType } : {}),
        })
        return successResult(result, config.model, config.thinkingLevel)
      } catch (error) {
        const structuredContent = serializeToolError({
          error,
          tool: modality,
          model: config.model,
          thinkingLevel: config.thinkingLevel,
          source,
        })

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
          isError: true,
        }
      }
    },
  )
}

export function createServer(service: GeminiService, config: AppConfig): McpServer {
  const server = new McpServer({
    name: 'gemini-understanding',
    version: '0.1.0',
  })

  server.registerTool(
    'web',
    {
      title: 'Gemini web research',
      description:
        'Use Gemini with both Google Search and URL Context enabled. Put ordinary webpage URLs directly in the prompt. Use video, audio, document, or image for typed media and file inputs.',
      inputSchema: {
        prompt: z.string().min(1).describe('A web question or instruction, including any ordinary webpage URLs.'),
      },
      annotations,
    },
    async ({ prompt }) => {
      try {
        const result = await service.web(prompt)
        return successResult(result, config.model, config.thinkingLevel)
      } catch (error) {
        const structuredContent = serializeToolError({
          error,
          tool: 'web',
          model: config.model,
          thinkingLevel: config.thinkingLevel,
        })

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
          isError: true,
        }
      }
    },
  )

  registerUnderstandingTool(
    server,
    service,
    config,
    'video',
    'Understand one video source. Accepts a public YouTube URL, a direct remote video URL, or a local video path. The caller chooses this modality; the server does not reclassify the source.',
  )
  registerUnderstandingTool(
    server,
    service,
    config,
    'audio',
    'Understand one audio source from a direct remote URL or local path. The caller chooses this modality; the server does not reclassify the source.',
  )
  registerUnderstandingTool(
    server,
    service,
    config,
    'document',
    'Understand one document source, such as a PDF, CSV, or text document, from a direct remote URL or local path. The caller chooses this modality; the server does not reclassify the source.',
  )
  registerUnderstandingTool(
    server,
    service,
    config,
    'image',
    'Understand one image source from a direct remote URL or local path. The caller chooses this modality; the server does not reclassify the source.',
  )

  return server
}
