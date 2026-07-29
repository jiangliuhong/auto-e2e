/**
 * Git 工作区读取（plan §16 阶段三）。
 *
 * 通过 git 命令获取仓库根目录与变更文件，便于测试时注入自定义执行函数。
 */
import { exec as nodeExec } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(nodeExec);

export interface ExecFn {
  (cmd: string, opts: { cwd: string }): Promise<{ stdout: string; stderr: string }>;
}

const defaultExec: ExecFn = (cmd, opts) => pexec(cmd, opts) as Promise<{ stdout: string; stderr: string }>;

export interface ChangedFiles {
  /** git 仓库根目录（绝对路径）。 */
  root: string;
  /** 工作区相对路径的变更文件（已修改/新增/删除/未跟踪）。 */
  files: string[];
  /** 原始 diff（name-status 形式）。 */
  raw: string;
}

export interface GitDiffReaderOptions {
  projectRoot: string;
  exec?: ExecFn;
}

/** 获取 git 仓库根目录。 */
export async function getGitRoot(projectRoot: string, exec: ExecFn = defaultExec): Promise<string> {
  const { stdout } = await exec('git rev-parse --show-toplevel', { cwd: projectRoot });
  return stdout.trim();
}

/** 判断目录是否在 git 仓库内。 */
export async function isGitRepo(projectRoot: string, exec: ExecFn = defaultExec): Promise<boolean> {
  try {
    await getGitRoot(projectRoot, exec);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取工作区变更文件（含未跟踪文件）。
 * - 已跟踪：git diff --name-status HEAD（暂存 + 工作区）
 * - 未跟踪：git ls-files --others --exclude-standard
 */
export async function readChangedFiles(
  opts: GitDiffReaderOptions,
): Promise<ChangedFiles> {
  const exec = opts.exec ?? defaultExec;
  const root = await getGitRoot(opts.projectRoot, exec);

  const trackedRaw = await exec(
    'git diff --name-status HEAD --no-renames',
    { cwd: opts.projectRoot },
  );
  const untrackedRaw = await exec(
    'git ls-files --others --exclude-standard',
    { cwd: opts.projectRoot },
  );

  const files: string[] = [];
  const seen = new Set<string>();

  // tracked: 行格式 "M\tpath"、"A\tpath"、"D\tpath" 等
  for (const line of trackedRaw.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('\t');
    const path = parts[parts.length - 1]!;
    if (path && !seen.has(path)) {
      seen.add(path);
      files.push(path);
    }
  }
  // untracked: 每行一个路径
  for (const line of untrackedRaw.stdout.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      files.push(trimmed);
    }
  }

  return {
    root,
    files,
    raw: trackedRaw.stdout + (untrackedRaw.stdout ? `\n--untracked--\n${untrackedRaw.stdout}` : ''),
  };
}

/** 获取最近一次提交的短信息，供变更分析参考。 */
export async function getRecentCommitMessage(
  projectRoot: string,
  exec: ExecFn = defaultExec,
): Promise<string> {
  const { stdout } = await exec('git log -1 --pretty=%s', { cwd: projectRoot });
  return stdout.trim();
}
