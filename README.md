# gemini-understanding

A deliberately small MCP server exposing Gemini's web and multimodal understanding through five tools:

- `web`
- `video`
- `audio`
- `document`
- `image`

The server uses the Gemini Interactions API. It does not inspect content to guess its modality. The calling agent chooses the tool, and Gemini returns the provider-side error when a modality, MIME type, URL, model, or thinking-level combination is invalid.

## Tool behavior

### `web`

Input:

```json
{
  "prompt": "Research the latest development and also read https://example.com/page"
}
```

Both Gemini server tools are enabled on every call:

- Google Search
- URL Context

Use this for general web research and ordinary webpages. Use one of the typed tools for direct media/file URLs.

### `video`, `audio`, `document`, and `image`

All four tools share this input:

```json
{
  "source": "a local path or public HTTP(S) URL",
  "prompt": "What should Gemini do with it?",
  "mimeType": "optional MIME type hint"
}
```

Examples:

```json
{
  "source": "https://www.youtube.com/watch?v=...",
  "prompt": "Summarize this video"
}
```

```json
{
  "source": "https://example.com/video.mp4",
  "prompt": "Describe the video",
  "mimeType": "video/mp4"
}
```

```json
{
  "source": "/workspace/report.pdf",
  "prompt": "Summarize the conclusions"
}
```

For remote sources, the URL is passed directly as a typed Gemini URI. YouTube is handled by calling `video` and normally omitting `mimeType`.

For local sources, the server:

1. resolves the path relative to the MCP server's working directory;
2. uploads it with the Gemini Files API;
3. waits for processing;
4. sends the uploaded URI as the caller-selected modality;
5. deletes the temporary upload.

The SDK infers local MIME types from file extensions when possible. The server performs no MIME sniffing, URL header probing, extension-based modality routing, or automatic fallback to another tool.

## Configuration

```text
GEMINI_API_KEY          required
GEMINI_MODEL            default: gemini-3.5-flash-lite
GEMINI_THINKING_LEVEL   default: high
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

## Error behavior

The server does not silently correct or reroute failed requests. Tool errors include the tool name, processing stage, configured model, thinking level, source where applicable, and the original Gemini status/code/message when available.

Local paths that do not exist fail at the filesystem stage because no API request can be constructed. Temporary-upload cleanup failures are non-fatal and are reported as warnings.
