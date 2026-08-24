import fs from 'node:fs/promises';
import type { Command } from 'commander';
import { ExitCode } from '../runtime/exit-codes.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { loadConfig } from '../config/config-loader.js';
import { createPiClient } from '../agent/pi-client-factory.js';
import type { RequirementAnalysisInput } from '../agent/pi-client.js';
import { SessionManager } from '../browser/session-manager.js';
import { explore, assertExplorationUsable } from '../browser/explorer.js';
import { saveExploration } from '../browser/evidence-collector.js';
import { generateTestFile } from '../playwright/test-generator.js';
import { readTaskSpec } from './_shared.js';
import { readChangedFiles, isGitRepo, getRecentCommitMessage } from '../git/git-diff-reader.js';
import { analyzeChanges } from '../git/change-analyzer.js';
import { withProgress } from '../runtime/progress.js';
import { AuthenticationManager } from '../auth/authentication-manager.js';

export interface GenerateOptions extends RunOptions {
  spec?: string;
}

export async function generateCommand(opts: GenerateOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    ctx.logger.info('开始生成 E2E 测试');
    // 1. 加载配置。
    const config = await loadConfig({ projectRoot: ctx.projectRoot });

    // 2. 读取并校验 task-spec。
    const specPath = ctx.resolve(opts.spec ?? '.auto-e2e/task-spec.json');
    const taskSpec = await readTaskSpec(specPath);

    // 真实认证环境先确认探索浏览器可用，避免在失效登录态上消耗模型调用。
    const authentication = new AuthenticationManager({
      projectRoot: ctx.projectRoot,
      config,
    });
    await authentication.assertReady(['explorer']);

    // 3. Pi 需求分析（合并 Git Diff 概要作为上下文）。
    const client = createPiClient({
      agent: config.agent, projectRoot: ctx.projectRoot, knowledge: config.knowledge,
    });
    const analysisInput: RequirementAnalysisInput = { taskSpec };
    if (await isGitRepo(ctx.projectRoot)) {
      try {
        const changes = await readChangedFiles({ projectRoot: ctx.projectRoot });
        if (changes.files.length > 0) {
          const summary = analyzeChanges(changes);
          analysisInput.changeSummary = {
            fileCount: summary.fileCount,
            routeFiles: summary.routeFiles,
            apiFiles: summary.apiFiles,
          };
        }
        analysisInput.recentCommitMessage = await getRecentCommitMessage(ctx.projectRoot).catch(
          () => undefined,
        );
      } catch {
        // 读 diff 失败不阻断生成流程。
      }
    }
    const analysis = await withProgress(ctx.logger, '分析需求与代码变更', () =>
      client.analyzeRequirement(analysisInput),
    );

    // 4. 生成 test-plan。
    const testPlan = await withProgress(ctx.logger, '生成测试计划', () =>
      client.createTestPlan({
        taskSpec,
        analysis,
        maxTestsPerTask: config.generation.maxTestsPerTask,
      }),
    );
    const taskDir = ctx.resolve(pathJoin(config.playwright.generatedDirectory, taskSpec.taskId));
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(
      pathJoin(taskDir, 'test-plan.json'),
      JSON.stringify(testPlan, null, 2) + '\n',
    );

    // 5. 探索页面。
    const manager = new SessionManager({ browser: config.browser });
    const bwClient = manager.getOrCreate(config.browser.sessionProfile);
    try {
      const exploration = await withProgress(ctx.logger, '探索页面并收集证据', () =>
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

      // 6. 生成测试文件。
      const artifact = await withProgress(ctx.logger, '生成并校验 Playwright 测试', () =>
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

      const message = `已生成测试：${artifact.specPath}`;
      return {
        exitCode: ExitCode.Ok,
        json: {
          ok: true,
          taskId: taskSpec.taskId,
          specPath: artifact.specPath,
          testPlanPath: pathJoin(taskDir, 'test-plan.json'),
          testCount: testPlan.testCases.length,
        },
        message,
      };
    } finally {
      await manager.closeAll();
    }
  });
}

function pathJoin(...parts: string[]): string {
  // 本地简单 join，避免顶层再 import path。
  return parts.join('/').replace(/\/+/g, '/');
}

export function registerGenerate(program: Command): void {
  program
    .command('generate')
    .description('根据 task-spec.json 分析需求、探索页面并生成 Playwright 测试（不执行）')
    .option('--spec <path>', 'task-spec.json 路径', '.auto-e2e/task-spec.json')
    .action(async (opts) => {
      const code = await generateCommand(mergeGlobalOpts(opts, program) as GenerateOptions);
      process.exit(code);
    });
}
