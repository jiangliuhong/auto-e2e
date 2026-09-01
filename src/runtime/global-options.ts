/**
 * 全局 CLI 选项合并工具。
 *
 * 独立成模块以避免 cli.ts <-> commands/* 的循环依赖。
 */
import type { Command } from 'commander';
import type { RunOptions } from './run-with-exit.js';

/**
 * 合并 program 层级的全局选项（--json / --non-interactive / --project-root / --quiet / --log-level）
 * 与子命令自己的选项，得到完整的 RunOptions + 子命令字段。
 */
export function mergeGlobalOpts(
  subOpts: Record<string, unknown>,
  root: Command,
): RunOptions & Record<string, unknown> {
  const rootOpts = root.opts();
  const quiet = (rootOpts['quiet'] as boolean) || false;
  const logLevel = rootOpts['logLevel'] as string | undefined;
  const resolvedLevel = quiet
    ? 'warn'
    : (logLevel as RunOptions['logLevel'] | undefined);
  return {
    projectRoot: rootOpts['projectRoot'] as string | undefined,
    json: (rootOpts['json'] as boolean) || (subOpts['json'] as boolean) || false,
    nonInteractive:
      (rootOpts['nonInteractive'] as boolean) ||
      (subOpts['nonInteractive'] as boolean) ||
      false,
    logLevel: resolvedLevel,
    ...subOpts,
  };
}
