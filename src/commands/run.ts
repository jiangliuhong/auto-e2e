import path from 'node:path';
import type { Command } from 'commander';
import { ExitCode, AutoE2EError } from '../runtime/exit-codes.js';
import type { RunOptions, CommandResult } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { loadConfig } from '../config/config-loader.js';
import { runPlaywright } from '../playwright/runner.js';
import { parsePlaywrightJson } from '../playwright/result-parser.js';
import type { ReporterConfigOptions } from '../playwright/reporter-config.js';
import { generateReport, printConsoleSummary } from '../report/report-generator.js';

export interface RunOptionsLike extends RunOptions {
  all?: boolean;
  suite?: string;
  tag?: string;
}

export async function runAllCommand(opts: RunOptionsLike): Promise<number> {
  return runCommand<RunResult>(opts, async (ctx) => {
    // --suite / --tag 第一版为预留参数。
    if (opts.suite) {
      throw new AutoE2EError(ExitCode.ConfigError, '--suite 第一版暂未实现');
    }
    if (opts.tag) {
      throw new AutoE2EError(ExitCode.ConfigError, '--tag 第一版暂未实现');
    }
    // 默认行为即 --all：执行全部已有测试。
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const startedAt = new Date().toISOString();

    const reportsDir = ctx.resolve(config.report.outputDirectory);
    const reporter: ReporterConfigOptions = {
      jsonReportPath: path.join(reportsDir, 'latest', 'playwright.json'),
      junitReportPath: path.join(reportsDir, 'latest', 'junit.xml'),
      htmlReportDir: path.join(reportsDir, 'latest', 'html'),
      formats: config.report.formats,
      retries: config.playwright.retries,
      workers: config.playwright.workers,
      trace: config.playwright.trace,
      screenshot: config.playwright.screenshot,
      video: config.playwright.video,
    };

    // 全量执行：尊重项目原有 playwright.config.ts，仅通过 CLI 追加 reporter。
    const outcome = await runPlaywright({
      projectRoot: ctx.projectRoot,
      reporter,
      mode: 'full',
      configFile: config.playwright.configFile,
      logger: ctx.logger,
    });

    // V-7.2：未执行任何用例 → Playwright 异常。
    if (outcome.exitCode === 8 || outcome.summary.total === 0) {
      throw new AutoE2EError(
        ExitCode.PlaywrightError,
        'Playwright 未执行任何用例（项目可能没有测试，或配置错误）。',
      );
    }

    const parsed = outcome.report
      ? parsePlaywrightJson(outcome.report)
      : {
          summary: outcome.summary,
          rawFailures: [],
          durationMs: 0,
        };

    const finishedAt = new Date().toISOString();
    const { paths, result } = await generateReport({
      taskId: 'full-run',
      mode: 'full',
      startedAt,
      finishedAt,
      summary: parsed.summary,
      coverage: { acceptanceCriteria: 0, covered: 0, uncovered: [] },
      failures: [],
      outputDirectory: reportsDir,
      logger: ctx.logger,
    });
    printConsoleSummary(result, ctx.logger);

    const exitCode = result.summary.failed > 0 ? ExitCode.TestsFailed : ExitCode.Ok;
    return {
      exitCode,
      json: {
        ok: exitCode === ExitCode.Ok,
        status: result.status,
        summary: result.summary,
        resultJsonPath: paths.resultJsonPath,
      },
      message: `run 完成：${result.status === 'passed' ? '通过' : '失败'}（${result.summary.passed}/${result.summary.total}）`,
    };
  });
}

interface RunResult {
  ok: boolean;
  status: 'passed' | 'failed';
  summary: { total: number; passed: number; failed: number; skipped: number; durationMs: number };
  resultJsonPath: string;
}

export function registerRun(program: Command): void {
  program
    .command('run')
    .description('执行项目已有 Playwright 测试（全量或指定测试集）')
    .option('--all', '执行全部测试')
    .option('--suite <name>', '（预留）执行指定测试集')
    .option('--tag <name>', '（预留）执行指定标签的测试')
    .action(async (opts) => {
      const code = await runAllCommand(mergeGlobalOpts(opts, program) as RunOptionsLike);
      process.exit(code);
    });
}
