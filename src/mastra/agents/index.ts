import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { mcp } from '../mcp/client';
import { parseGmailDOM, summarizeParsedGmailDOM, summarizeYamlSnapshot } from '../parsing/gmail';

// Log available tools at startup
const rawTools = await mcp.getTools();

// Helper: summarize tool result
function summarizeToolResult(result: any, url?: string): any {
  if (typeof result === 'string') {
    if (result.includes('<html') && url) {
      // Gmail HTML
      const parsed = parseGmailDOM(result, url);
      return summarizeParsedGmailDOM(parsed);
    } else if (result.includes('Page Snapshot') || result.includes('document [ref=')) {
      // YAML snapshot
      return summarizeYamlSnapshot(result);
    } else if (result.length > 1000) {
      // Fallback: truncate
      return result.split('\n').slice(0, 10).join('\n') + '\n... (truncated, summarized)';
    }
    return result;
  }
  if (result && typeof result === 'object' && typeof result.content === 'string') {
    return { ...result, content: summarizeToolResult(result.content, url) };
  }
  if (result && Array.isArray(result.content)) {
    const newContent = result.content.map((item: any) => {
      if (item && item.type === 'text' && typeof item.text === 'string' && item.text.length > 1000) {
        return { ...item, text: summarizeToolResult(item.text, url) };
      }
      return item;
    });
    return { ...result, content: newContent };
  }
  return result;
}

// Wrap each tool to log usage and summarize results
const loggingAndSummarizingTools: Record<string, any> = {};
for (const [name, tool] of Object.entries(rawTools)) {
  loggingAndSummarizingTools[name] = {
    ...tool,
    execute: async (args: any) => {
      console.log(`[GmailAgent] Tool used: ${name}`, args);
      try {
        const result = await tool.execute(args);
        console.log(`[GmailAgent] Tool result (raw): ${name}`, result);
        // Try to get URL from args if present
        const url = args && (args.url || args.pageUrl || args.targetUrl);
        const summarized = summarizeToolResult(result, url);
        console.log(`[GmailAgent] Tool result (summarized): ${name}`, summarized);
        return summarized;
      } catch (err) {
        console.error(`[GmailAgent] Tool error: ${name}`, err);
        throw err;
      }
    },
  };
}

export const tediAssistant = new Agent({
  name: 'Tedi Assistant',
  description: 'Helps you navigate websites and perform actions.',
  instructions: `
    You are a helpful assistant that can access websites.
    Use the tools to perform actions (click, type, etc).
    Always confirm actions that modify or send data.
  `,
  model: openai(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
  tools: loggingAndSummarizingTools,
});
