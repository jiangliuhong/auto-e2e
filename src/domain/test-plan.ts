/**
 * test-plan.json 规范（plan §9）。
 *
 * 由 Pi 根据任务信息生成，每条验收标准必须至少被一个测试用例覆盖。
 */
import { z } from 'zod';

export const TestCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  priority: z.enum(['P0', 'P1', 'P2']),
  type: z.enum(['positive', 'negative', 'edge']),
  acceptanceCriteria: z.array(z.string().min(1)),
  preconditions: z.array(z.string().min(1)).optional(),
  steps: z.array(z.string().min(1)),
  expected: z.array(z.string().min(1)),
});

export const TestPlanSchema = z.object({
  taskId: z.string().min(1),
  scope: z.enum(['incremental', 'full']),
  testCases: z.array(TestCaseSchema).min(1),
  uncoveredCriteria: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestPlan = z.infer<typeof TestPlanSchema>;

export function validateTestPlan(raw: unknown): { success: boolean; plan?: TestPlan; errors: string[] } {
  const parsed = TestPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  return { success: true, plan: parsed.data, errors: [] };
}
