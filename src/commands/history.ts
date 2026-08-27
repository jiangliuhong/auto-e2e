import type { Command } from 'commander';
import { AcceptanceHistoryStore } from '../acceptance/history-store.js';
import { loadConfig } from '../config/config-loader.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

export async function listCommand(opts: RunOptions & { limit?: number | string }): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const limit = Number(opts.limit ?? 50);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new AutoE2EError(ExitCode.Blocked, '--limit 必须是正整数');
    }
    const runs = await new AcceptanceHistoryStore(
      ctx.projectRoot,
      config.acceptance.databasePath,
    ).list(limit);
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, runs },
      message: formatRunList(runs),
    };
  });
}

export async function showCommand(opts: RunOptions & { runId: string }): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const run = await new AcceptanceHistoryStore(
      ctx.projectRoot,
      config.acceptance.databasePath,
    ).get(opts.runId);
    if (!run) throw new AutoE2EError(ExitCode.Blocked, `未找到运行记录：${opts.runId}`);
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, run },
      message: formatRun(run),
    };
  });
}

export function registerHistory(program: Command): void {
  program.command('list')
    .description('列出 BetterWright 验收历史')
    .option('--limit <number>', '最多返回的记录数', '50')
    .action(async (opts) => process.exit(await listCommand(mergeGlobalOpts(opts, program))));
  program.command('show <run-id>')
    .description('查看一次 BetterWright 验收详情')
    .action(async (runId, opts) => process.exit(await showCommand({
      ...mergeGlobalOpts(opts, program),
      runId,
    })));
}

function formatRunList(runs: Awaited<ReturnType<AcceptanceHistoryStore['list']>>): string {
  if (runs.length === 0) return '暂无 BetterWright 验收历史';
  return runs.map((run) =>
    `${run.runId}\t${run.status}\t${run.requirement}\t${run.targetUrl}`,
  ).join('\n');
}

function formatRun(run: NonNullable<Awaited<ReturnType<AcceptanceHistoryStore['get']>>>): string {
  const criteria = run.criteria.map((criterion) =>
    `- [${criterion.status}] ${criterion.id} ${criterion.description}: ${criterion.actual}`,
  ).join('\n');
  return `${run.runId} · ${run.status}\n${run.summary}\n${criteria}`;
}
