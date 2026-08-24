import { z } from 'zod';

export const EvaluationMetricsSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  taskId: z.string(),
  autoE2EVersion: z.string(),
  mode: z.enum(['incremental', 'full']),
  requirementCount: z.number().int().nonnegative().nullable(),
  generatedTestCount: z.number().int().nonnegative().nullable(),
  coveredRequirementCount: z.number().int().nonnegative().nullable(),
  passedTestCount: z.number().int().nonnegative(),
  failedTestCount: z.number().int().nonnegative(),
  skippedTestCount: z.number().int().nonnegative(),
  totalDurationMs: z.number().int().nonnegative(),
  explorerDurationMs: z.number().int().nonnegative().nullable(),
  llmCallCount: z.number().int().nonnegative(),
  llmRetryCount: z.number().int().nonnegative(),
  tokenUsage: z.number().int().nonnegative().nullable(),
  agent: z.object({ implementation: z.string(), provider: z.string(), model: z.string() }),
  browser: z.object({
    implementation: z.string(),
    playwrightVersion: z.string().nullable().optional(),
    betterwrightVersion: z.string().nullable().optional(),
  }),
  promptHashes: z.record(z.string()),
  knowledgeHashes: z.record(z.string()),
});

export type EvaluationMetrics = z.infer<typeof EvaluationMetricsSchema>;
