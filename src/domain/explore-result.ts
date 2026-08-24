/**
 * BetterWright 探索结果规范（plan §10.2）。
 */
import { z } from 'zod';
import { ExploredActionSchema } from './exploration-action.js';

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
      /** 探索完成时浏览器所在的真实 URL，用于识别重定向或认证落点。 */
      url: z.string().url().optional(),
      title: z.string().optional(),
      reachable: z.boolean(),
      /** 页面已稳定并成功产出可交互快照。 */
      ready: z.boolean().optional(),
      /** 快照采集失败或超时时的可操作原因。 */
      snapshotError: z.string().optional(),
      elements: z.array(
        z.object({
          description: z.string(),
          recommendedLocator: z.string(),
          fallbackLocators: z.array(z.string()).default([]),
          stable: z.boolean(),
          /** 定位器在真实页面上的匹配数量。 */
          observedCount: z.number().int().nonnegative().optional(),
          visible: z.boolean().optional(),
          enabled: z.boolean().optional(),
          /** 仅当定位器唯一且可见时为 true。 */
          verified: z.boolean().optional(),
        }),
      ),
      /** 同一浏览器会话中实际执行并重新取证的安全探索动作。 */
      actions: z.array(ExploredActionSchema).optional(),
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
