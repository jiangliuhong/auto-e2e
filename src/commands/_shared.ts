/**
 * 命令共享工具。
 */
import fs from 'node:fs/promises';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { validateTaskSpec } from '../domain/task-spec.js';
import type { TaskSpec } from '../domain/task-spec.js';

/**
 * 读取并校验 task-spec.json。
 * - 文件缺失 / 解析失败 / 校验失败 → 退出码 4。
 * - acceptanceCriteria 为空 → 退出码 4。
 */
export async function readTaskSpec(specPath: string): Promise<TaskSpec> {
  let content: string;
  try {
    content = await fs.readFile(specPath, 'utf8');
  } catch (err) {
    throw new AutoE2EError(
      ExitCode.InsufficientRequirement,
      `无法读取 task-spec：${specPath}（${err instanceof Error ? err.message : String(err)}）`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (err) {
    throw new AutoE2EError(
      ExitCode.InsufficientRequirement,
      `task-spec 不是合法 JSON：${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const validation = validateTaskSpec(raw);
  if (!validation.success) {
    throw new AutoE2EError(
      ExitCode.InsufficientRequirement,
      `task-spec 校验失败：${validation.errors.join('; ')}`,
    );
  }
  if (validation.isEmptyCriteria) {
    throw new AutoE2EError(
      ExitCode.InsufficientRequirement,
      'task-spec 缺少验收标准（acceptanceCriteria 为空）',
    );
  }
  return validation.spec!;
}
