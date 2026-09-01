import { z } from 'zod';

export const AcceptanceSourceSchema = z.object({
  // markdown/openspec are retained only so previously stored runs remain readable.
  type: z.enum(['task-spec', 'markdown', 'openspec']),
  reference: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
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

export const AcceptanceWorkflowStepResultSchema = z.object({
  id: z.string().regex(/^STEP-\d{2,}$/),
  instruction: z.string().min(1),
  expected: z.string().min(1),
  status: z.enum(['passed', 'failed', 'blocked', 'skipped']),
  actual: z.string().min(1),
  proof: z.string().min(1).nullable().default(null),
  durationMs: z.number().int().nonnegative().optional(),
  error: z.string().min(1).nullable().default(null),
});

const ResultValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
]);

export const AcceptanceResultAssertionSchema = z.object({
  id: z.string().regex(/^RESULT-\d{2,}$/),
  name: z.string().min(1),
  status: z.enum(['passed', 'failed', 'blocked']),
  expected: ResultValueSchema,
  actual: ResultValueSchema,
  match: z.enum(['equals', 'contains', 'numeric', 'visual', 'table', 'file']),
  difference: ResultValueSchema.optional(),
  proof: z.string().min(1).nullable().default(null),
  error: z.string().min(1).nullable().default(null),
});

const StructuredCaseFields = {
  specDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  workflowSteps: z.array(AcceptanceWorkflowStepResultSchema).min(1).optional(),
  resultAssertions: z.array(AcceptanceResultAssertionSchema).min(1).optional(),
};

export const SingleAcceptanceRunSchema = z.object({
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
  ...StructuredCaseFields,
});

export const AcceptanceCaseRunSchema = z.object({
  caseId: z.string().min(1),
  source: AcceptanceSourceSchema,
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
  ...StructuredCaseFields,
});

export const AcceptanceSuiteRunSchema = z.object({
  schemaVersion: z.literal(2),
  runId: z.string().regex(/^\d{8}T\d{9}Z-[a-f0-9]{8}$/),
  project: z.string().min(1),
  source: AcceptanceSourceSchema,
  commit: z.string().nullable(),
  targetUrl: z.string().url(),
  profile: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(['passed', 'failed', 'blocked', 'error']),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  summary: z.string(),
  cases: z.array(AcceptanceCaseRunSchema).min(1),
  steps: z.number().int().nonnegative(),
  proof: z.string().nullable(),
  error: z.string().nullable(),
});

export const AcceptanceRunSchema = z.union([
  SingleAcceptanceRunSchema,
  AcceptanceSuiteRunSchema,
]);

export type AcceptanceSource = z.infer<typeof AcceptanceSourceSchema>;
export type AcceptanceCriterionInput = z.infer<typeof AcceptanceCriterionInputSchema>;
export type AcceptanceCriterionResult = z.infer<typeof AcceptanceCriterionResultSchema>;
export type AcceptanceAgentAnswer = z.infer<typeof AcceptanceAgentAnswerSchema>;
export type AcceptanceWorkflowStepResult = z.infer<typeof AcceptanceWorkflowStepResultSchema>;
export type AcceptanceResultAssertion = z.infer<typeof AcceptanceResultAssertionSchema>;
export type SingleAcceptanceRun = z.infer<typeof SingleAcceptanceRunSchema>;
export type AcceptanceCaseRun = z.infer<typeof AcceptanceCaseRunSchema>;
export type AcceptanceSuiteRun = z.infer<typeof AcceptanceSuiteRunSchema>;
export type AcceptanceRun = z.infer<typeof AcceptanceRunSchema>;
