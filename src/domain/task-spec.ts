import { z } from 'zod';

export const TaskSpecSchema = z.object({
  taskId: z.string().min(1).optional(),
  title: z.string().min(1),
  requirement: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
}).strict();

export type TaskSpec = z.infer<typeof TaskSpecSchema>;

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
