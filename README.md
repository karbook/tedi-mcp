# Tedi MCP

## Connect to Your Favorite AI Tools

You can connect this MCP server to AI tools like Cursor, Windsurf, Claude, and others to automate your browser.

**Endpoints:**
- **SSE:**  `http://localhost:4111/api/mcp/mcpServer/sse`
- **HTTP:** `http://localhost:4111/api/mcp/mcpServer/mcp`
- **Version:** 1.0.0

### Example: Registering in Cursor (SSE)
Cursor comes with built-in MCP support. Add the following to your Cursor MCP server configuration:

```json
{
  "mcpServers": {
    "Tedi Assistants": {
      "url": "http://localhost:4111/api/mcp/mcpServer/sse"
    }
  }
}
```

---

## Overview

This project wraps [Browser MCP](https://browsermcp.io/) in a [Mastra](https://mastra.ai/) MCP server, exposing it via SSE and HTTP protocols. This allows AI applications to connect to your browser and automate tasks or tests using the Browser MCP extension.

- **Browser MCP**: Lets AI apps automate your browser via a local extension.
- **Mastra MCP Server**: Exposes Browser MCP tools over HTTP and SSE endpoints for easy integration with AI tools.

## Features
- Exposes Browser MCP tools via `/mcp` (HTTP) and `/sse` (SSE) endpoints
- Allows AI apps (like Cursor, Claude, etc.) to connect and automate your browser

## Prerequisites
- Node.js (v18+ recommended)
- [Browser MCP extension](https://browsermcp.io/) installed in your browser

## Setup

1. **Install dependencies**
   ```sh
   npm install
   # or
   bun install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env` and fill in any required values (if needed).
   - Make sure the Browser MCP extension is running in your browser.

3. **Run the Mastra MCP Server**
   ```sh
   npx mastra dev
   # or
   npm run dev
   ```
   The server will start locally, exposing `/mcp` and `/sse` endpoints.

4. **Connect your AI app**
   - Point your AI app (e.g., Cursor, Claude) to your local `/mcp` or `/sse` endpoint as described in the Browser MCP documentation.

## Usage
- Visit [Browser MCP](https://browsermcp.io/) for extension setup and documentation.
- Use your AI app to connect to the local Mastra MCP server and start automating your browser.

## Deployment
- This project is designed to run locally or on any Node.js-compatible server.

## Future Improvements
- **Custom Parsing Mechanisms:** To reduce hitting context/token limits when Browser MCP returns entire DOM structures, future versions could implement custom parsing and summarization strategies. This would allow only the most relevant information to be sent to the AI, improving efficiency and usability.
- **Agents and Workflows:** The Mastra framework supports custom agents and workflows. You can implement your own agents and define workflows for more advanced, multi-step automation and reasoning.

## License
MIT
