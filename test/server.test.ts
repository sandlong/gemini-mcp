import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config.js'
import { createServer } from '../src/server.js'
import type {
  GeminiService,
  LocalFileRequest,
  Modality,
  RemoteFileRequest,
  ServiceResult,
} from '../src/service.js'

const config: AppConfig = {
  apiKey: 'test-key',
  model: 'gemini-3.5-flash-lite',
  thinkingLevel: 'high',
}

class FakeService implements GeminiService {
  async web(prompt: string): Promise<ServiceResult> {
    return { text: `web:${prompt}`, interactionId: 'web-id' }
  }

  async understandRemote(modality: Modality, request: RemoteFileRequest): Promise<ServiceResult> {
    return { text: `remote:${modality}:${request.url}:${request.prompt}`, interactionId: 'remote-id' }
  }

  async understandLocal(modality: Modality, request: LocalFileRequest): Promise<ServiceResult> {
    return { text: `local:${modality}:${request.path}:${request.prompt}`, interactionId: 'local-id' }
  }
}

const closeables: Array<{ close(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(closeables.splice(0).map((item) => item.close()))
})

describe('MCP surface', () => {
  it('exposes exactly the three independent tool names', async () => {
    const server = createServer(new FakeService(), config)
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    closeables.push(client, server)

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const result = await client.listTools()

    expect(result.tools.map((tool) => tool.name).sort()).toEqual(['local_file', 'remote_file', 'web'])
    expect(client.getInstructions()).toContain('intended for one-shot use')

    const descriptions = Object.fromEntries(result.tools.map((tool) => [tool.name, tool.description ?? '']))
    expect(descriptions.web).not.toContain('remote_file')
    expect(descriptions.web).not.toContain('local_file')
    expect(descriptions.remote_file).not.toContain('web')
    expect(descriptions.remote_file).not.toContain('local_file')
    expect(descriptions.local_file).not.toContain('web')
    expect(descriptions.local_file).not.toContain('remote_file')
  })

  it('routes a declared remote modality without classifying the URL', async () => {
    const server = createServer(new FakeService(), config)
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    closeables.push(client, server)

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const result = await client.callTool({
      name: 'remote_file',
      arguments: {
        url: 'https://www.youtube.com/watch?v=abc',
        type: 'video',
        prompt: 'Summarize it',
      },
    })

    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'remote:video:https://www.youtube.com/watch?v=abc:Summarize it',
      },
    ])
  })

  it('routes a declared local modality through the local-file path', async () => {
    const server = createServer(new FakeService(), config)
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    closeables.push(client, server)

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const result = await client.callTool({
      name: 'local_file',
      arguments: {
        path: '/workspace/report.pdf',
        type: 'document',
        prompt: 'Summarize it',
      },
    })

    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'local:document:/workspace/report.pdf:Summarize it',
      },
    ])
  })

  it('requires an explicit file type', async () => {
    const server = createServer(new FakeService(), config)
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    closeables.push(client, server)

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const result = await client.callTool({
      name: 'remote_file',
      arguments: {
        url: 'https://example.com/report.pdf',
        prompt: 'Summarize it',
      },
    })

    expect(result.isError).toBe(true)
  })
})
