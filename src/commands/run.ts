import { InvalidArgumentError, type Command } from 'commander';
import { executeAcceptance } from '../acceptance/acceptance-runner.js';
import { loadConfig } from '../config/config-loader.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

export interface AcceptanceRunOptions extends RunOptions {
  spec?: string;
  url?: string;
  profile?: string;
  model?: string;
  session?: string;
  headed?: boolean;
  fresh?: boolean;
  concurrency?: number;
}

export async function runAcceptanceCommand(opts: AcceptanceRunOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot, configPath: opts.config });
    const result = await executeAcceptance({
      projectRoot: ctx.projectRoot,
      config,
      spec: opts.spec,
      url: opts.url,
      profile: opts.profile,
      model: opts.model,
      session: opts.session,
      headed: opts.headed,
      fresh: opts.fresh,
      concurrency: opts.concurrency,
      logger: ctx.logger,
    });
    const exitCode = result.status === 'passed'
      ? ExitCode.Ok
      : result.status === 'failed'
        ? ExitCode.TestsFailed
        : ExitCode.Blocked;
    const cases = result.schemaVersion === 1 ? [result] : result.cases;
    const criteria = cases.flatMap((item) => item.criteria);
    const passedCases = cases.filter((item) => item.status === 'passed').length;
    const passedCriteria = criteria.filter((item) => item.status === 'passed').length;
    return {
      exitCode,
      json: { ok: exitCode === ExitCode.Ok, run: result },
      message: `验收完成：${result.status}（用例 ${passedCases}/${cases.length}，AC ${passedCriteria}/${criteria.length}）\nRun ID: ${result.runId}`,
    };
  });
}

export function registerRun(program: Command): void {
  program.command('run')
    .description('使用 BetterWright 验证需求并保存验收记录')
    .option('--spec <path>', '读取一个 Spec Bundle、spec.json 或包含多个 Bundle 的目录（默认 .auto-e2e/specs）')
    .option('--url <url>', '目标环境 URL（默认读取 project.baseUrl）')
    .option('--profile <name>', 'BetterWright 身份 Profile')
    .option('--model <model>', 'BetterWright 模型')
    .option('--session <name>', 'BetterWright 会话名')
    .option('--headed', '显示浏览器窗口')
    .option('--fresh', '使用全新 BetterWright 会话')
    .option('--concurrency <count>', '并发执行的用例数（默认读取 acceptance.concurrency）', parseConcurrency)
    .action(async (opts) => {
      process.exit(await runAcceptanceCommand(
        mergeGlobalOpts(opts, program) as AcceptanceRunOptions,
      ));
    });
}

function parseConcurrency(value: string): number {
  const concurrency = Number(value);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new InvalidArgumentError('并发数必须是 1 到 32 之间的整数');
  }
  return concurrency;
}
