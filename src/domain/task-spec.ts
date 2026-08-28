import { z } from 'zod';

export const TaskFileInputSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().min(1).optional(),
}).strict();

export const TaskExpectedOutputSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  expected: z.union([z.string(), z.number().finite(), z.boolean()]),
  match: z.enum(['equals', 'contains', 'numeric']).optional(),
  tolerance: z.number().finite().nonnegative().optional(),
}).strict().superRefine((output, context) => {
  if (output.match === 'contains' && typeof output.expected !== 'string') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expected'],
      message: 'contains 匹配的 expected 必须是字符串',
    });
  }
  if ((output.match === 'numeric' || output.tolerance !== undefined) &&
      typeof output.expected !== 'number') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expected'],
      message: 'numeric 匹配或 tolerance 的 expected 必须是数字',
    });
  }
  if (output.tolerance !== undefined && output.match !== undefined && output.match !== 'numeric') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tolerance'],
      message: 'tolerance 只能用于 numeric 匹配',
    });
  }
});

export type TaskFileInput = z.infer<typeof TaskFileInputSchema>;
export type TaskExpectedOutput = z.infer<typeof TaskExpectedOutputSchema>;

export const TaskSpecSchema = z.object({
  taskId: z.string().min(1).optional(),
  title: z.string().min(1),
  requirement: z.string().min(1),
  inputs: z.array(TaskFileInputSchema).min(1).optional(),
  outputs: z.array(TaskExpectedOutputSchema).min(1).optional(),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
}).strict();

export type TaskSpec = z.infer<typeof TaskSpecSchema>;

export const ACCEPTANCE_SPEC_DIRECTORY = '.auto-e2e/specs';
export const ACCEPTANCE_SPEC_SUFFIX = '.spec.json';

export function isAcceptanceSpecFileName(fileName: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.spec\.json$/.test(fileName);
}

export function validateTaskSpec(raw: unknown): {
  success: boolean;
  spec?: TaskSpec;
  errors: string[];
} {
  const parsed = TaskSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };
  }
  return { success: true, spec: parsed.data, errors: [] };
}
