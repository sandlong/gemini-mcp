#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { serializeToolError } from './errors.js'
import { createServer } from './server.js'
import { GoogleGeminiService } from './service.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const service = new GoogleGeminiService(config)
  const server = createServer(service, config)
  const transport = new StdioServerTransport()

  await server.connect(transport)
  console.error(`gemini-understanding running on stdio with model ${config.model}`)
}

main().catch((error) => {
  const structured = serializeToolError({
    error,
    tool: 'server',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    thinkingLevel: process.env.GEMINI_THINKING_LEVEL || 'high',
    defaultStage: 'configuration',
  })
  console.error(JSON.stringify(structured, null, 2))
  process.exit(1)
})
