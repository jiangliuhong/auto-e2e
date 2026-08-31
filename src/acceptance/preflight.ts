import fs from 'node:fs/promises';
import path from 'node:path';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import type { TaskFileInput } from '../domain/task-spec.js';

export interface ValidatedFileInput {
  item: TaskFileInput;
  source: string;
}

export function validateTargetUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('仅支持 http/https');
    return url.toString();
  } catch (error) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `目标 URL 无效：${raw}（${error instanceof Error ? error.message : String(error)}）`,
    );
  }
}

export async function validateFileInputs(
  projectRoot: string,
  inputs: TaskFileInput[],
): Promise<ValidatedFileInput[]> {
  let canonicalProjectRoot: string;
  try {
    canonicalProjectRoot = await fs.realpath(projectRoot);
  } catch (error) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `无法读取项目目录：${projectRoot}（${error instanceof Error ? error.message : String(error)}）`,
      error,
    );
  }

  const validated: ValidatedFileInput[] = [];
  for (const item of inputs) {
    if (path.isAbsolute(item.path)) {
      throw new AutoE2EError(ExitCode.Blocked, `输入文件必须使用项目内相对路径：${item.path}`);
    }
    const requested = path.resolve(canonicalProjectRoot, item.path);
    let source: string;
    try {
      source = await fs.realpath(requested);
      await fs.access(source, fs.constants.R_OK);
    } catch (error) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `输入文件不存在或不可读：${item.path}（${error instanceof Error ? error.message : String(error)}）`,
        error,
      );
    }
    const relative = path.relative(canonicalProjectRoot, source);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new AutoE2EError(ExitCode.Blocked, `输入文件不能位于项目目录之外：${item.path}`);
    }
    if (!(await fs.stat(source)).isFile()) {
      throw new AutoE2EError(ExitCode.Blocked, `输入路径不是普通文件：${item.path}`);
    }
    validated.push({ item, source });
  }
  return validated;
}
