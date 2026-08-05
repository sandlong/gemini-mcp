import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { AppConfig } from './config.js'
import { serializeToolError } from './errors.js'
import type { GeminiService, Modality, ServiceResult } from './service.js'

const modalitySchema = z
  .enum(['image', 'video', 'audio', 'document'])
  .describe('Required source type. Choose exactly one of image, video, audio, or document.')

const remoteFileInputSchema = {
  url: z
    .string()
    .min(1)
    .url()
    .refine((value) => /^https?:\/\//i.test(value), 'URL must use HTTP or HTTPS')
    .describe('A public HTTP(S) URL for one file. Public YouTube URLs are accepted when type is video.'),
  type: modalitySchema,
  prompt: z.string().min(1).describe('What Gemini should determine, describe, extract, or summarize.'),
  mimeType: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Optional MIME type. Prefer to include it for direct remote files when known because origin metadata may be missing or malformed. Usually omit it for YouTube URLs.',
    ),
}

const localFileInputSchema = {
  path: z
    .string()
    .min(1)
    .describe('A path to one file on the MCP server filesystem. Relative paths use the server working directory.'),
  type: modalitySchema,
  prompt: z.string().min(1).describe('What Gemini should determine, describe, extract, or summarize.'),
  mimeType: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Optional MIME type override. Normally omit it when the file extension is recognized; provide it when Gemini cannot infer the local file MIME type.',
    ),
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

export function createServer(service: GeminiService, config: AppConfig): McpServer {
  const server = new McpServer(
    {
      name: 'gemini-understanding',
      version: '0.2.0',
    },
    {
      instructions:
        'This server is intended for one-shot use. Each call sends one prompt and at most one source to Gemini, returns one answer, and does not link calls into a continuing conversation. Each tool is self-contained and may be exposed independently by an MCP client or gateway.',
    },
  )

  server.registerTool(
    'web',
    {
      title: 'Gemini web research',
      description:
        'Perform one-shot Gemini web research with both Google Search and URL Context enabled. The prompt may include ordinary webpage URLs.',
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

  server.registerTool(
    'remote_file',
    {
      title: 'Gemini remote file understanding',
      description:
        'Analyze one public HTTP(S) file URL in a single Gemini request. The caller must declare the source type as image, video, audio, or document. Public YouTube URLs are supported as video sources.',
      inputSchema: remoteFileInputSchema,
      annotations,
    },
    async ({ url, type, prompt, mimeType }) => {
      try {
        const result = await service.understandRemote(type as Modality, {
          url,
          prompt,
          ...(mimeType ? { mimeType } : {}),
        })
        return successResult(result, config.model, config.thinkingLevel)
      } catch (error) {
        const structuredContent = serializeToolError({
          error,
          tool: 'remote_file',
          model: config.model,
          thinkingLevel: config.thinkingLevel,
          source: url,
        })

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
          isError: true,
        }
      }
    },
  )

  server.registerTool(
    'local_file',
    {
      title: 'Gemini local file understanding',
      description:
        'Analyze one file available on the MCP server filesystem in a single Gemini request. The caller must declare the source type as image, video, audio, or document.',
      inputSchema: localFileInputSchema,
      annotations,
    },
    async ({ path, type, prompt, mimeType }) => {
      try {
        const result = await service.understandLocal(type as Modality, {
          path,
          prompt,
          ...(mimeType ? { mimeType } : {}),
        })
        return successResult(result, config.model, config.thinkingLevel)
      } catch (error) {
        const structuredContent = serializeToolError({
          error,
          tool: 'local_file',
          model: config.model,
          thinkingLevel: config.thinkingLevel,
          source: path,
        })

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
          isError: true,
        }
      }
    },
  )

  return server
}
