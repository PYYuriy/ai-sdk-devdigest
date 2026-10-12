import { tool } from 'ai';
import { z } from 'zod';
import { withToolErrorHandling } from '@/app/tools/withToolErrorHandling';

export const chaosTool = tool({
  description:
    'A tool that always fails. Use this to demonstrate that tool errors ' +
    'are handled gracefully without crashing the chat stream.',
  inputSchema: z.object({
    reason: z.string().default('chaos').describe('Why the failure is simulated'),
  }),
  execute: withToolErrorHandling('chaos', async ({ reason }) => {
    throw new Error(`Simulated failure: ${reason}`);
  }),
});