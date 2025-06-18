import { MCPClient } from '@mastra/mcp';

export const mcp = new MCPClient({
  servers: {
    browsermcp: {
      command: 'npx',
      args: ['-y', '@browsermcp/mcp@latest'],
    },
  },
}); 