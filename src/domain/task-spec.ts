/**
 * task-spec.json 规范（plan §8）。
 *
 * Codex 完成开发后必须生成此文件，作为 auto-e2e 本次任务的输入。
 * 必填字段：taskId / title / requirement / acceptanceCriteria / changedFiles
 * 可选字段：changedRoutes / changedApis / riskHints / startCommand / baseUrl
 */
import { z } from 'zod';

export const TaskSpecSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1),
  requirement: z.string().min(1),
  /** 验收标准数组。verify 命令要求非空，空时返回退出码 4。 */
  acceptanceCriteria: z.array(z.string().min(1)),
  changedFiles: z.array(z.string().min(1)),
  changedRoutes: z.array(z.string().min(1)).optional(),
  changedApis: z.array(z.string().min(1)).optional(),
  riskHints: z.array(z.string().min(1)).optional(),
  startCommand: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

export type TaskSpec = z.infer<typeof TaskSpecSchema>;

/**
 * 校验 task-spec，返回结构化结果。
 * - 解析失败返回 success=false 与错误列表。
 * - acceptanceCriteria 为空返回 isEmptyCriteria=true（调用方据此返回退出码 4）。
 */
export interface TaskSpecValidation {
  success: boolean;
  spec?: TaskSpec;
  errors: string[];
  /** acceptanceCriteria 为空（但其余字段合法）。 */
  isEmptyCriteria: boolean;
}

export function validateTaskSpec(raw: unknown): TaskSpecValidation {
  // 先做字段存在性/类型的基础校验，再判断 acceptanceCriteria。
  const parsed = TaskSpecSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    );
    // 单独识别 acceptanceCriteria 为空的场景，以便精确退出码 4。
    const isEmpty =
      Array.isArray((raw as { acceptanceCriteria?: unknown })?.acceptanceCriteria) &&
      ((raw as { acceptanceCriteria?: unknown[] }).acceptanceCriteria?.length ?? 0) === 0;
    return { success: false, errors, isEmptyCriteria: isEmpty };
  }
  const spec = parsed.data;
  if (spec.acceptanceCriteria.length === 0) {
    return {
      success: true,
      spec,
      errors: [],
      isEmptyCriteria: true,
    };
  }
  return { success: true, spec, errors: [], isEmptyCriteria: false };
}
