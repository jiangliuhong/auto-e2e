import fs from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';
import { ExitCode, AutoE2EError } from '../runtime/exit-codes.js';
import type { RunOptions, CommandResult } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { loadConfig } from '../config/config-loader.js';
import type { TaskSpec } from '../domain/task-spec.js';
import { createPiClient } from '../agent/pi-client-factory.js';
import type { RequirementAnalysisInput } from '../agent/pi-client.js';
import { SessionManager } from '../browser/session-manager.js';
import { explore, assertExplorationUsable } from '../browser/explorer.js';
import { saveExploration } from '../browser/evidence-collector.js';
import { generateTestFile } from '../playwright/test-generator.js';
import { runPlaywright } from '../playwright/runner.js';
import { parsePlaywrightJson, computeCoverage } from '../playwright/result-parser.js';
import type { ReporterConfigOptions } from '../playwright/reporter-config.js';
import {
  generateReport,
  printConsoleSummary,
  publishLatest,
} from '../report/report-generator.js';
import { ensureAppRunning } from '../project/process-manager.js';
import { readTaskSpec } from './_shared.js';
import { readChangedFiles, isGitRepo, getRecentCommitMessage } from '../git/git-diff-reader.js';
import { analyzeChanges } from '../git/change-analyzer.js';
import { createRunId } from '../runtime/run-id.js';
import { writeEvaluationMetrics } from '../evaluation/metrics-writer.js';
import { withProgress } from '../runtime/progress.js';
import type { FailureEntry } from '../domain/test-result.js';
import { AuthenticationManager } from '../auth/authentication-manager.js';

export interface VerifyOptions extends RunOptions {
  spec?: string;
  changed?: boolean;
}

export async function verifyCommand(opts: VerifyOptions): Promise<number> {
  return runCommand<VerifyResult>(opts, async (ctx) => {
    ctx.logger.info('开始完整验证：分析 → 探索 → 生成 → 执行 → 报告');
    // 1. 加载配置
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const commandStartedMs = Date.now();
    const startedAt = new Date().toISOString();
    const runId = createRunId();

    // 在模型调用、页面探索和业务写操作前同时验证两套独立认证状态。
    const authentication = new AuthenticationManager({
      projectRoot: ctx.projectRoot,
      config,
    });
    const authenticationState = await authentication.assertReady(['explorer', 'runner']);

    // 2. 获取 task-spec：优先读取 --spec；--changed 模式下基于 Git Diff 推导。
    const taskSpec = await resolveTaskSpec(ctx.projectRoot, opts);

    // 3-4. 需求分析（含 Git Diff 概要）+ 5. test-plan
    const client = createPiClient({
      agent: config.agent, projectRoot: ctx.projectRoot, knowledge: config.knowledge,
    });
    const analysisInput = await buildAnalysisInput(ctx.projectRoot, taskSpec, opts);
    const analysis = await withProgress(ctx.logger, '分析需求与代码变更', () =>
      client.analyzeRequirement(analysisInput),
    );
    const testPlan = await withProgress(ctx.logger, '生成测试计划', () =>
      client.createTestPlan({
        taskSpec,
        analysis,
        maxTestsPerTask: config.generation.maxTestsPerTask,
      }),
    );

    const taskDir = ctx.resolve(
      joinRel(config.playwright.generatedDirectory, taskSpec.taskId),
    );
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'test-plan.json'),
      JSON.stringify(testPlan, null, 2) + '\n',
    );

    // 6-7. 启动/连接目标应用 + 健康检查
    const app = await withProgress(ctx.logger, '检查并启动目标应用', () =>
      ensureAppRunning({
        projectRoot: ctx.projectRoot,
        manageApplication: config.project.manageApplication,
        startCommand: taskSpec.startCommand ?? config.project.startCommand,
        healthUrl: config.project.healthUrl,
        startupTimeout: config.project.startupTimeout,
        logger: ctx.logger,
      }),
    );

    try {
      // 8. 探索页面
      const manager = new SessionManager({ browser: config.browser });
      const bwClient = manager.getOrCreate(config.browser.sessionProfile);
      let exploration;
      const explorerStartedMs = Date.now();
      let explorerDurationMs = 0;
      try {
        exploration = await withProgress(ctx.logger, '探索页面并收集证据', () =>
          explore(
            {
              taskId: taskSpec.taskId,
              baseUrl: taskSpec.baseUrl ?? config.project.baseUrl,
              routes: taskSpec.changedRoutes ?? ['/'],
              acceptanceCriteria: taskSpec.acceptanceCriteria,
              testCases: testPlan.testCases as unknown[],
              sessionProfile: config.browser.sessionProfile,
            },
            {
              client: bwClient,
              session: config.browser.sessionProfile,
              timeoutMs: config.browser.timeout,
              decideAction: (input) => client.decideExplorationAction(input),
            },
          ),
        );
        assertExplorationUsable(exploration);
        await saveExploration(taskDir, exploration);
      } finally {
        explorerDurationMs = Date.now() - explorerStartedMs;
        await manager.closeAll();
      }

      // 9. 生成测试
      const gen = await withProgress(ctx.logger, '生成并校验 Playwright 测试', () =>
        generateTestFile({
          projectRoot: ctx.projectRoot,
          generatedDirectory: config.playwright.generatedDirectory,
          client,
          taskSpec,
          testPlan,
          exploration,
          preferTestId: config.generation.preferTestId,
          overwrite: config.generation.overwriteGeneratedTests,
          logger: ctx.logger,
        }),
      );

      // 10. 执行测试（增量模式：临时 config，含 reporter 与 use 选项）
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

      const outcome = await withProgress(ctx.logger, '执行 Playwright 测试', () =>
        runPlaywright({
          projectRoot: ctx.projectRoot,
          reporter,
          mode: 'incremental',
          testFiles: [gen.specPath],
          baseURL: taskSpec.baseUrl ?? config.project.baseUrl,
          channel: config.browser.channel,
          storageStatePath: authenticationState.runnerStatePath,
          logger: ctx.logger,
          machineReadable: ctx.json,
        }),
      );

      // V-7.2：未执行任何用例 → Playwright 异常，退出码 8。
      if (outcome.exitCode > 1 || !outcome.report || outcome.summary.total === 0) {
        throw new AutoE2EError(
          ExitCode.PlaywrightError,
          'Playwright 未执行任何用例（可能为编译失败或配置错误），已生成的测试见：' +
            gen.specPath,
        );
      }

      // 11. 解析结果 + 12. 失败分类
      const parsed = outcome.report
        ? parsePlaywrightJson(outcome.report)
        : {
            summary: outcome.summary,
            rawFailures: [],
            durationMs: 0,
          };

      const failures: FailureEntry[] = [];
      await withProgress(ctx.logger, '分析测试失败', async () => {
        for (const raw of parsed.rawFailures) {
          failures.push(
            await client.analyzeFailure({
              testTitle: raw.test,
              errorMessage: raw.message,
              errorStack: raw.stack,
              artifacts: await existingArtifacts(ctx.projectRoot, raw.artifacts),
            }),
          );
        }
      });

      const coverage = computeCoverage(
        taskSpec.acceptanceCriteria,
        testPlan.testCases.flatMap((t) => t.acceptanceCriteria),
      );

      const finishedAt = new Date().toISOString();
      const { paths, result } = await generateReport({
        runId,
        taskId: taskSpec.taskId,
        mode: 'incremental',
        startedAt,
        finishedAt,
        summary: parsed.summary,
        coverage,
        failures,
        outputDirectory: reportsDir,
        logger: ctx.logger,
        publishLatest: false,
      });
      const telemetry = client.getTelemetry();
      await writeEvaluationMetrics(ctx.projectRoot, {
        schemaVersion: 1,
        runId,
        taskId: taskSpec.taskId,
        autoE2EVersion: '0.2.0',
        mode: 'incremental',
        requirementCount: taskSpec.acceptanceCriteria.length,
        generatedTestCount: testPlan.testCases.length,
        coveredRequirementCount: coverage.covered,
        passedTestCount: result.summary.passed,
        failedTestCount: result.summary.failed,
        skippedTestCount: result.summary.skipped,
        totalDurationMs: Date.now() - commandStartedMs,
        explorerDurationMs,
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
          taskId: taskSpec.taskId,
          status: result.status,
          summary: result.summary,
          coverage: { covered: coverage.covered, total: coverage.acceptanceCriteria },
          resultJsonPath: paths.resultJsonPath,
          runId,
          runDirectory: paths.runDirectory,
          runResultJsonPath: paths.runResultJsonPath,
        },
        message: `verify 完成：${result.status === 'passed' ? '通过' : '失败'}（${result.summary.passed}/${result.summary.total}）`,
      };
    } finally {
      // 关闭由本工具启动的应用进程。
      await app.stop();
    }
  });
}

/**
 * 解析 task-spec：
 * - 默认读取 --spec（或默认 .auto-e2e/task-spec.json）。
 * - --changed 且 task-spec 不存在时：基于 Git Diff 推导基础 task-spec。
 * - --changed 且非 Git 仓库：明确报错（F12）。
 */
async function resolveTaskSpec(projectRoot: string, opts: VerifyOptions): Promise<TaskSpec> {
  const specPath = path.resolve(projectRoot, opts.spec ?? '.auto-e2e/task-spec.json');
  const specExists = await fs
    .access(specPath)
    .then(() => true)
    .catch(() => false);

  if (specExists) {
    return readTaskSpec(specPath);
  }

  // task-spec 不存在。
  if (!opts.changed) {
    // 非 --changed 模式：交给 readTaskSpec 抛出标准的 exit 4 错误。
    return readTaskSpec(specPath);
  }

  // --changed 模式：基于 Git Diff 推导。
  if (!(await isGitRepo(projectRoot))) {
    throw new AutoE2EError(
      ExitCode.ConfigError,
      `当前目录不是 Git 仓库（${projectRoot}），无法基于 Git Diff 执行。请在一个 Git 仓库内运行，或提供 --spec。`,
    );
  }

  const changes = await readChangedFiles({ projectRoot });
  if (changes.files.length === 0) {
    throw new AutoE2EError(
      ExitCode.InsufficientRequirement,
      '未检测到 Git Diff（工作区无变更），且未提供 task-spec。请先产生代码变更或提供 --spec。',
    );
  }

  const summary = analyzeChanges(changes);
  const commit = await getRecentCommitMessage(projectRoot).catch(() => 'TASK-FROM-DIFF');
  const taskId = `DIFF-${commit.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}` || 'TASK-FROM-DIFF';

  return {
    taskId,
    title: commit,
    requirement: `基于 Git Diff 自动推导：变更 ${summary.fileCount} 个文件`,
    acceptanceCriteria: [
      ...summary.routeFiles.map((f) => `页面变更可正常访问：${f}`),
      ...summary.apiFiles.map((f) => `接口变更可正常调用：${f}`),
    ],
    changedFiles: changes.files,
    changedRoutes: [],
    changedApis: [],
  };
}

/** 构造需求分析输入：若有 Git Diff，把变更概要合并进去。 */
async function buildAnalysisInput(
  projectRoot: string,
  taskSpec: TaskSpec,
  opts: VerifyOptions,
): Promise<RequirementAnalysisInput> {
  const input: RequirementAnalysisInput = { taskSpec };

  // 即便有 task-spec，也尽量读取 Git Diff 作为补充上下文。
  if (await isGitRepo(projectRoot)) {
    try {
      const changes = await readChangedFiles({ projectRoot });
      if (changes.files.length > 0) {
        const summary = analyzeChanges(changes);
        input.changeSummary = {
          fileCount: summary.fileCount,
          routeFiles: summary.routeFiles,
          apiFiles: summary.apiFiles,
        };
      }
      input.recentCommitMessage = await getRecentCommitMessage(projectRoot).catch(() => undefined);
    } catch {
      // 读 diff 失败不阻断流程（task-spec 仍可用）。
      if (opts.changed) {
        throw new AutoE2EError(
          ExitCode.ConfigError,
          '指定了 --changed 但读取 Git Diff 失败。',
        );
      }
    }
  } else if (opts.changed) {
    // --changed 但非 Git：resolveTaskSpec 已处理无 task-spec 的情况；
    // 此处针对有 task-spec 但非 Git 的场景给出提示。
    throw new AutoE2EError(
      ExitCode.ConfigError,
      `--changed 需要在 Git 仓库内执行（${projectRoot} 不是 Git 仓库）。`,
    );
  }

  return input;
}

interface VerifyResult {
  ok: boolean;
  taskId: string;
  status: 'passed' | 'failed';
  summary: { total: number; passed: number; failed: number; skipped: number; durationMs: number };
  coverage: { covered: number; total: number };
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
  const entries = await Promise.all(
    Object.entries(artifacts).map(async ([key, value]) => [
      key,
      value && await fs.access(path.resolve(projectRoot, value))
        .then(() => path.resolve(projectRoot, value)).catch(() => undefined),
    ] as const),
  );
  const filtered = Object.fromEntries(entries.filter(([, value]) => value));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function joinRel(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

export function registerVerify(program: Command): void {
  program
    .command('verify')
    .description('完整执行本次任务闭环：分析→探索→生成→执行→报告')
    .option('--spec <path>', 'task-spec.json 路径', '.auto-e2e/task-spec.json')
    .option('--changed', '基于 Git Diff 执行（无 task-spec 时自动推导）')
    .action(async (opts) => {
      const code = await verifyCommand(mergeGlobalOpts(opts, program) as VerifyOptions);
      process.exit(code);
    });
}
