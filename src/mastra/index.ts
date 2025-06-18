import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { mcpServer } from './mcp/server';

export const mastra = new Mastra({
  agents: {},
  workflows: {},
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  mcpServers: {
    mcpServer,
  }
});
