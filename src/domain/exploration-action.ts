import { z } from 'zod';

/**
 * 模型在状态化探索中只能选择已验证元素，不能返回任意浏览器代码。
 */
export const ExplorationDecisionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    elementIndex: z.number().int().nonnegative(),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal('complete'),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal('blocked'),
    reason: z.string().min(1),
  }),
]);

export type ExplorationDecision = z.infer<typeof ExplorationDecisionSchema>;

export interface ExplorationDecisionInput {
  taskId: string;
  route: string;
  acceptanceCriteria: string[];
  testCases: unknown[];
  current: {
    url: string;
    title?: string;
    elements: Array<{
      index: number;
      description: string;
      locator: string;
      enabled: boolean;
    }>;
  };
  history: Array<{
    step: number;
    description: string;
    status: 'success' | 'blocked' | 'failed';
  }>;
}

export const ExploredActionSchema = z.object({
  step: z.number().int().positive(),
  type: z.literal('click'),
  description: z.string().min(1),
  locator: z.string().min(1),
  reason: z.string().min(1),
  beforeUrl: z.string().url(),
  afterUrl: z.string().url().optional(),
  status: z.enum(['success', 'blocked', 'failed']),
  error: z.string().optional(),
});

export type ExploredAction = z.infer<typeof ExploredActionSchema>;
