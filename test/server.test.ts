import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config.js'
import { createServer } from '../src/server.js'
import type { GeminiService, Modality, ServiceResult, UnderstandingRequest } from '../src/service.js'

const config: AppConfig = {
  apiKey: 'test-key',
  model: 'gemini-3.5-flash-lite',
  thinkingLevel: 'high',
}

class FakeService implements GeminiService {
  async web(prompt: string): Promise<ServiceResult> {
    return { text: `web:${prompt}`, interactionId: 'web-id' }
  }

  async understand(modality: Modality, request: UnderstandingRequest): Promise<ServiceResult> {
    return { text: `${modality}:${request.source}:${request.prompt}`, interactionId: 'media-id' }
  }
}

const closeables: Array<{ close(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(closeables.splice(0).map((item) => item.close()))
})

describe('MCP surface', () => {
  it('exposes exactly the five simple tool names', async () => {
    const server = createServer(new FakeService(), config)
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    closeables.push(client, server)

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const result = await client.listTools()

    expect(result.tools.map((tool) => tool.name).sort()).toEqual(['audio', 'document', 'image', 'video', 'web'])
  })

  it('returns Gemini text directly from a tool call', async () => {
    const server = createServer(new FakeService(), config)
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    closeables.push(client, server)

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const result = await client.callTool({
      name: 'video',
      arguments: {
        source: 'https://www.youtube.com/watch?v=abc',
        prompt: 'Summarize it',
      },
    })

    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'video:https://www.youtube.com/watch?v=abc:Summarize it',
      },
    ])
  })
})
