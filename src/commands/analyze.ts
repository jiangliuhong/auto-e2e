import path from 'node:path';
import type { Command } from 'commander';
import { ExitCode, AutoE2EError } from '../runtime/exit-codes.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { loadConfig } from '../config/config-loader.js';
import { createPiClient } from '../agent/pi-client-factory.js';
import { analyzeLastRun } from '../report/failure-analyzer.js';
import { withProgress } from '../runtime/progress.js';

export interface AnalyzeOptions extends RunOptions {
  last?: boolean;
}

export async function analyzeCommand(opts: AnalyzeOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    ctx.logger.info('开始分析最近一次测试结果');
    if (!opts.last) {
      throw new AutoE2EError(ExitCode.ConfigError, '目前仅支持 --last');
    }
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const reportsDir = ctx.resolve(config.report.outputDirectory);
    const latestDir = ctx.resolve(path.join(config.report.outputDirectory, 'latest'));
    const artifactDir = ctx.resolve(config.report.artifactDirectory);
    const client = createPiClient({
      agent: config.agent, projectRoot: ctx.projectRoot, knowledge: config.knowledge,
    });

    const { failures, updatedResult } = await withProgress(
      ctx.logger,
      '读取报告并分析失败原因',
      () =>
        analyzeLastRun({
          latestDir,
          artifactDir,
          projectRoot: ctx.projectRoot,
          client,
        }),
    );

    const message =
      failures.length === 0
        ? '没有失败用例需要分析'
        : `分析 ${failures.length} 个失败：\n` +
          failures
            .map((f) => `  - ${f.test}（${f.category}，置信度 ${f.confidence}）：${f.message}`)
            .join('\n');
    ctx.logger.info(message);

    return {
      exitCode: ExitCode.Ok,
      json: {
        ok: true,
        failures,
        resultJsonPath: updatedResult ? `${reportsDir}/latest/result.json` : undefined,
      },
      message,
    };
  });
}

export function registerAnalyze(program: Command): void {
  program
    .command('analyze')
    .description('分析最近一次测试失败原因并分类')
    .option('--last', '分析最近一次 Playwright 结果')
    .action(async (opts) => {
      const code = await analyzeCommand(mergeGlobalOpts(opts, program) as AnalyzeOptions);
      process.exit(code);
    });
}
