import fs from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';
import { AcceptanceHistoryStore } from '../acceptance/history-store.js';
import { loadConfig } from '../config/config-loader.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { exportAcceptanceReport, type ReportExportFormat } from '../server/report-export.js';

interface ShowOptions extends RunOptions {
  runId: string;
  format?: string;
  output?: string;
}

export async function listCommand(opts: RunOptions & { limit?: number | string }): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot, configPath: opts.config });
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

export async function showCommand(opts: ShowOptions): Promise<number> {
  return runCommand<unknown>(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot, configPath: opts.config });
    const run = await new AcceptanceHistoryStore(
      ctx.projectRoot,
      config.acceptance.databasePath,
    ).get(opts.runId);
    if (!run) throw new AutoE2EError(ExitCode.Blocked, `未找到运行记录：${opts.runId}`);
    const format = reportExportFormat(opts.format);
    if (opts.output && !format) {
      throw new AutoE2EError(ExitCode.Blocked, '--output 必须和 --format 一起使用');
    }
    if (format) {
      const extension = format === 'html' ? 'html' : 'md';
      const outputPath = path.resolve(opts.output ?? `auto-e2e-${run.runId}.${extension}`);
      const content = await exportAcceptanceReport(run, format, {
        projectRoot: ctx.projectRoot,
        artifactDirectory: config.report.artifactDirectory,
      });
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, content, 'utf8');
      return {
        exitCode: ExitCode.Ok,
        json: { ok: true, runId: run.runId, format, output: outputPath },
        message: `报告已导出：${outputPath}`,
      };
    }
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
    .option('--format <format>', '导出格式：html | markdown')
    .option('-o, --output <path>', '导出文件路径（默认写入当前目录）')
    .action(async (runId, opts) => process.exit(await showCommand({
      ...mergeGlobalOpts(opts, program),
      runId,
    })));
}

function reportExportFormat(value?: string): ReportExportFormat | undefined {
  if (value === undefined) return undefined;
  if (value === 'html') return 'html';
  if (value === 'markdown' || value === 'md') return 'markdown';
  throw new AutoE2EError(ExitCode.Blocked, '--format 必须是 html 或 markdown');
}

function formatRunList(runs: Awaited<ReturnType<AcceptanceHistoryStore['list']>>): string {
  if (runs.length === 0) return '暂无 BetterWright 验收历史';
  return runs.map((run) =>
    `${run.runId}\t${run.status}\t${run.requirement}\t${run.targetUrl}`,
  ).join('\n');
}

function formatRun(run: NonNullable<Awaited<ReturnType<AcceptanceHistoryStore['get']>>>): string {
  const cases = run.schemaVersion === 1
    ? [{
        caseId: null, source: run.source, status: run.status, criteria: run.criteria,
        workflowSteps: run.workflowSteps, resultAssertions: run.resultAssertions, specDigest: run.specDigest,
      }]
    : run.cases;
  const details = cases.map((testCase) => {
    const heading = testCase.caseId
      ? `${testCase.caseId} · ${testCase.source.title} · ${testCase.status}\n`
      : '';
    const criteria = testCase.workflowSteps || testCase.resultAssertions
      ? [
          ...(testCase.workflowSteps ?? []).map((step) =>
            `- [${step.status}] ${step.id} ${step.instruction}: ${step.actual}`,
          ),
          ...(testCase.resultAssertions ?? []).map((result) =>
            `- [${result.status}] ${result.id} ${result.name}: ${JSON.stringify(result.actual)}`,
          ),
        ].join('\n')
      : testCase.criteria.map((criterion) =>
      `- [${criterion.status}] ${criterion.id} ${criterion.description}: ${criterion.actual}`,
      ).join('\n');
    const digest = testCase.specDigest ? `Spec ${testCase.specDigest}\n` : '';
    return `${heading}${digest}${criteria}`;
  }).join('\n');
  return `${run.runId} · ${run.status}\n${run.summary}\n${details}`;
}
