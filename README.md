# gemini-understanding

A minimal MCP server for one-shot Gemini requests. Each tool call sends one prompt and at most one source, returns one answer, and does not link calls into a continuing conversation.

The server exposes three independent tools:

- `web`
- `remote_file`
- `local_file`

Clients and MCP gateways may expose any subset of the tools. This is useful for remote or isolated deployments where filesystem access is unavailable or undesirable: `local_file` can be hidden without changing the contract of the remaining tools.

## `web`

Performs one-shot web research with both Gemini server tools enabled:

- Google Search
- URL Context

Input:

```json
{
  "prompt": "Research the topic and read https://example.com/page"
}
```

Ordinary webpage URLs may be included directly in the prompt.

## `remote_file`

Analyzes one public HTTP(S) file URL. The caller must declare the source type; the server does not inspect the URL or reclassify the source.

Input:

```json
{
  "url": "https://example.com/report.pdf",
  "type": "document",
  "prompt": "Summarize the conclusions",
  "mimeType": "application/pdf"
}
```

`type` is required and must be one of:

- `image`
- `video`
- `audio`
- `document`

`mimeType` is optional, but it is preferred for direct remote files when known because origin servers may return missing, generic, malformed, or parameterized MIME metadata. Public YouTube URLs are supplied with `type: "video"` and normally omit `mimeType`.

Examples:

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "type": "video",
  "prompt": "Summarize this video"
}
```

```json
{
  "url": "https://example.com/audio.mp3",
  "type": "audio",
  "prompt": "Transcribe the speech",
  "mimeType": "audio/mpeg"
}
```

The URL is passed directly to Gemini as a typed URI. The server performs no HTTP header probing, MIME sniffing, extension-based routing, downloading, conversion, or cross-type fallback.

## `local_file`

Analyzes one file available on the MCP server filesystem. The caller must declare the source type; the server does not inspect the content or reclassify the source.

Input:

```json
{
  "path": "/workspace/report.pdf",
  "type": "document",
  "prompt": "Summarize the conclusions"
}
```

`type` is required and must be one of:

- `image`
- `video`
- `audio`
- `document`

`mimeType` is optional. The Gemini SDK normally infers it from a recognized file extension. It may be supplied as an override when inference is unavailable or incorrect.

The server:

1. resolves relative paths against its working directory;
2. uploads the file through the Gemini Files API;
3. waits until processing is complete;
4. sends the uploaded URI using the declared source type;
5. deletes the temporary upload.

The path refers to the filesystem visible to the MCP server process. In a remote, containerized, or isolated deployment, it does not refer to the MCP client's filesystem unless that storage is explicitly mounted or shared.

## Configuration

```text
GEMINI_API_KEY          required
GEMINI_BASE_URL         optional; default: official Google Gemini API endpoint
GEMINI_MODEL            default: gemini-3.5-flash-lite
GEMINI_THINKING_LEVEL   default: high
```

`GEMINI_BASE_URL` replaces the Gemini API base URL used by the Google Gen AI SDK. Leave it unset to use Google's official endpoint. This is useful with compatible reverse proxies or API gateways, for example:

```text
GEMINI_BASE_URL=https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/google-ai-studio
```

Custom model and thinking-level strings are passed through without compatibility validation.

## Install from GitHub

```bash
claude mcp add gemini-understanding -s user -- \
  env GEMINI_API_KEY=YOUR_KEY \
  npx -y github:sandlong/gemini-understanding
```

With explicit optional settings:

```bash
claude mcp add gemini-understanding -s user -- \
  env GEMINI_API_KEY=YOUR_KEY \
      GEMINI_BASE_URL=https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/google-ai-studio \
      GEMINI_MODEL=gemini-3.5-flash-lite \
      GEMINI_THINKING_LEVEL=high \
  npx -y github:sandlong/gemini-understanding
```

## Local development

```bash
npm install
npm test
npm run build
```

Run the stdio server:

```bash
GEMINI_API_KEY=YOUR_KEY npm start
```

The stdio implementation can also be placed behind an MCP gateway that exposes it through Streamable HTTP. Tool filtering remains a client or gateway concern.

## Error behavior

The server does not silently correct or reroute failed requests. Tool errors include the tool name, processing stage, configured model, thinking level, source, and the original Gemini status, code, and message when available.

A nonexistent server-side path fails at the filesystem stage because no API request can be constructed. Temporary-upload cleanup failures are non-fatal and are reported as warnings.
