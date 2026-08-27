import { z } from 'zod';

export const AcceptanceSourceSchema = z.object({
  type: z.enum(['task-spec', 'markdown', 'openspec']),
  reference: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});

export const AcceptanceCriterionInputSchema = z.object({
  id: z.string().regex(/^AC-\d{2,}$/),
  description: z.string().min(1),
});

export const AcceptanceCriterionResultSchema = AcceptanceCriterionInputSchema.extend({
  status: z.enum(['passed', 'failed', 'blocked']),
  actual: z.string().min(1),
  proof: z.string().min(1).nullable().default(null),
});

export const AcceptanceAgentAnswerSchema = z.object({
  summary: z.string().min(1),
  criteria: z.array(AcceptanceCriterionResultSchema).min(1),
});

export const AcceptanceRunSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().regex(/^\d{8}T\d{9}Z-[a-f0-9]{8}$/),
  project: z.string().min(1),
  source: AcceptanceSourceSchema,
  commit: z.string().nullable(),
  targetUrl: z.string().url(),
  profile: z.string().min(1),
  model: z.string().min(1),
  session: z.string().min(1),
  status: z.enum(['passed', 'failed', 'blocked', 'error']),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  summary: z.string(),
  criteria: z.array(AcceptanceCriterionResultSchema).min(1),
  steps: z.number().int().nonnegative(),
  proof: z.string().nullable(),
  error: z.string().nullable(),
});

export type AcceptanceSource = z.infer<typeof AcceptanceSourceSchema>;
export type AcceptanceCriterionInput = z.infer<typeof AcceptanceCriterionInputSchema>;
export type AcceptanceCriterionResult = z.infer<typeof AcceptanceCriterionResultSchema>;
export type AcceptanceAgentAnswer = z.infer<typeof AcceptanceAgentAnswerSchema>;
export type AcceptanceRun = z.infer<typeof AcceptanceRunSchema>;
