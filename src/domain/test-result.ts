/**
 * result.json 规范（plan §13.1）与失败条目结构。
 */
import { z } from 'zod';
import { FAILURE_CATEGORIES } from './failure-category.js';

export const TestSummarySchema = z.object({
  total: z.number().int(),
  passed: z.number().int(),
  failed: z.number().int(),
  skipped: z.number().int(),
  durationMs: z.number().int(),
});

export const FailureEntrySchema = z.object({
  test: z.string(),
  category: z.enum(FAILURE_CATEGORIES),
  message: z.string(),
  expected: z.string().optional(),
  actual: z.string().optional(),
  confidence: z.number().min(0).max(1),
  artifacts: z
    .object({
      screenshot: z.string().optional(),
      trace: z.string().optional(),
      video: z.string().optional(),
    })
    .optional(),
});

export const CoverageSchema = z.object({
  acceptanceCriteria: z.number().int(),
  covered: z.number().int(),
  uncovered: z.array(z.string()),
});

export const TestResultSchema = z.object({
  taskId: z.string(),
  status: z.enum(['passed', 'failed']),
  mode: z.enum(['incremental', 'full']),
  startedAt: z.string(),
  finishedAt: z.string(),
  summary: TestSummarySchema,
  coverage: CoverageSchema,
  failures: z.array(FailureEntrySchema).default([]),
});

export type TestSummary = z.infer<typeof TestSummarySchema>;
export type FailureEntry = z.infer<typeof FailureEntrySchema>;
export type Coverage = z.infer<typeof CoverageSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
