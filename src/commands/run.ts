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
import {
  generateReport,
  printConsoleSummary,
  publishLatest,
} from '../report/report-generator.js';
import { createPiClient } from '../agent/pi-client-factory.js';
import { createRunId } from '../runtime/run-id.js';
import fs from 'node:fs/promises';
import { writeEvaluationMetrics } from '../evaluation/metrics-writer.js';
import { withProgress } from '../runtime/progress.js';
import type { FailureEntry } from '../domain/test-result.js';
import { AuthenticationManager } from '../auth/authentication-manager.js';

export interface RunOptionsLike extends RunOptions {
  all?: boolean;
  suite?: string;
  tag?: string;
}

export async function runAllCommand(opts: RunOptionsLike): Promise<number> {
  return runCommand<RunResult>(opts, async (ctx) => {
    ctx.logger.info('开始执行项目 Playwright 测试');
    // --suite / --tag 第一版为预留参数。
    if (opts.suite) {
      throw new AutoE2EError(ExitCode.ConfigError, '--suite 第一版暂未实现');
    }
    if (opts.tag) {
      throw new AutoE2EError(ExitCode.ConfigError, '--tag 第一版暂未实现');
    }
    // 默认行为即 --all：执行全部已有测试。
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const commandStartedMs = Date.now();
    const startedAt = new Date().toISOString();
    const runId = createRunId();

    const authentication = new AuthenticationManager({
      projectRoot: ctx.projectRoot,
      config,
    });
    const authenticationState = await authentication.assertReady(['runner']);

    const reportsDir = ctx.resolve(config.report.outputDirectory);
    const runDirectory = path.join(reportsDir, 'runs', runId);
    const reporter: ReporterConfigOptions = {
      jsonReportPath: path.join(runDirectory, 'playwright.json'),
      junitReportPath: path.join(runDirectory, 'junit.xml'),
      htmlReportDir: path.join(runDirectory, 'html'),
      formats: config.report.formats,
      retries: config.playwright.retries,
      workers: config.playwright.workers,
      trace: config.playwright.trace,
      screenshot: config.playwright.screenshot,
      video: config.playwright.video,
    };

    // 全量执行：尊重项目原有 playwright.config.ts，仅通过 CLI 追加 reporter。
    const outcome = await withProgress(ctx.logger, '执行 Playwright 测试', () =>
      runPlaywright({
        projectRoot: ctx.projectRoot,
        reporter,
        mode: 'full',
        configFile: config.playwright.configFile,
        channel: config.browser.channel,
        storageStatePath: authenticationState.runnerStatePath,
        logger: ctx.logger,
        machineReadable: ctx.json,
      }),
    );

    // V-7.2：未执行任何用例 → Playwright 异常。
    if (outcome.exitCode > 1 || !outcome.report || outcome.summary.total === 0) {
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
    const client = createPiClient({
      agent: config.agent, projectRoot: ctx.projectRoot, knowledge: config.knowledge,
    });
    const failures: FailureEntry[] = [];
    await withProgress(ctx.logger, '分析测试失败', async () => {
      for (const raw of parsed.rawFailures) {
        failures.push(await client.analyzeFailure({
          testTitle: raw.test,
          errorMessage: raw.message,
          errorStack: raw.stack,
          artifacts: await existingArtifacts(ctx.projectRoot, raw.artifacts),
        }));
      }
    });
    const { paths, result } = await generateReport({
      runId,
      taskId: 'full-run',
      mode: 'full',
      startedAt,
      finishedAt,
      summary: parsed.summary,
      coverage: { acceptanceCriteria: 0, covered: 0, uncovered: [] },
      failures,
      outputDirectory: reportsDir,
      logger: ctx.logger,
      publishLatest: false,
    });
    const telemetry = client.getTelemetry();
    await writeEvaluationMetrics(ctx.projectRoot, {
      schemaVersion: 1,
      runId,
      taskId: 'full-run',
      autoE2EVersion: '0.2.0',
      mode: 'full',
      requirementCount: null,
      generatedTestCount: null,
      coveredRequirementCount: null,
      passedTestCount: result.summary.passed,
      failedTestCount: result.summary.failed,
      skippedTestCount: result.summary.skipped,
      totalDurationMs: Date.now() - commandStartedMs,
      explorerDurationMs: null,
      llmCallCount: telemetry.calls,
      llmRetryCount: telemetry.retries,
      tokenUsage: telemetry.tokenUsage,
      agent: {
        implementation: config.agent.implementation,
        provider: config.agent.provider,
        model: config.agent.model,
      },
      browser: {
        implementation: config.browser.implementation,
        playwrightVersion: '1.48.0',
        betterwrightVersion: null,
      },
      promptHashes: telemetry.promptHashes,
      knowledgeHashes: telemetry.knowledgeHashes,
    });
    await publishLatest(reportsDir, runId);
    printConsoleSummary(result, ctx.logger);

    const exitCode = result.status === 'failed' ? ExitCode.TestsFailed : ExitCode.Ok;
    return {
      exitCode,
      json: {
        ok: exitCode === ExitCode.Ok,
        status: result.status,
        summary: result.summary,
        resultJsonPath: paths.resultJsonPath,
        runId,
        runDirectory: paths.runDirectory,
        runResultJsonPath: paths.runResultJsonPath,
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
  runId: string;
  runDirectory: string;
  runResultJsonPath: string;
}

async function existingArtifacts(
  projectRoot: string,
  artifacts?: { screenshot?: string; trace?: string; video?: string },
): Promise<typeof artifacts> {
  if (!artifacts) return undefined;
  const entries = await Promise.all(Object.entries(artifacts).map(async ([key, value]) => [
    key,
    value && await fs.access(path.resolve(projectRoot, value))
      .then(() => path.resolve(projectRoot, value)).catch(() => undefined),
  ] as const));
  const filtered = Object.fromEntries(entries.filter(([, value]) => value));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
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
