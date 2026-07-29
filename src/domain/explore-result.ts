/**
 * BetterWright 探索结果规范（plan §10.2）。
 */
import { z } from 'zod';

export const ExploreRequestSchema = z.object({
  taskId: z.string().min(1),
  baseUrl: z.string().url(),
  routes: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  testCases: z.array(z.unknown()),
  sessionProfile: z.string().optional(),
});

export const ExploreResultSchema = z.object({
  taskId: z.string().min(1),
  pages: z.array(
    z.object({
      route: z.string(),
      title: z.string().optional(),
      reachable: z.boolean(),
      elements: z.array(
        z.object({
          description: z.string(),
          recommendedLocator: z.string(),
          fallbackLocators: z.array(z.string()).default([]),
          stable: z.boolean(),
        }),
      ),
      observedRequests: z.array(
        z.object({
          method: z.string(),
          url: z.string(),
          status: z.number().optional(),
        }),
      ),
      screenshots: z.array(z.string()),
    }),
  ),
  blockers: z.array(z.string()).default([]),
});

export type ExploreRequest = z.infer<typeof ExploreRequestSchema>;
export type ExploreResult = z.infer<typeof ExploreResultSchema>;
