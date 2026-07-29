/**
 * 报告生成器（plan §13）。
 *
 * 产出：
 * - reports/latest/result.json（TestResult schema）
 * - reports/latest/summary.md
 * - 控制台摘要
 * JUnit / HTML 由 Playwright reporter 直接生成，本模块只负责 result.json 与 summary.md。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TestResult, FailureEntry, Coverage } from '../domain/test-result.js';
import type { Logger } from '../runtime/logger.js';

export interface ReportPaths {
  latestDir: string;
  resultJsonPath: string;
  summaryPath: string;
}

export interface GenerateReportInput {
  taskId: string;
  mode: 'incremental' | 'full';
  startedAt: string;
  finishedAt: string;
  summary: TestResult['summary'];
  coverage: Coverage;
  failures: FailureEntry[];
  outputDirectory: string;
  logger?: Logger;
}

export async function generateReport(input: GenerateReportInput): Promise<{
  paths: ReportPaths;
  result: TestResult;
}> {
  const latestDir = path.resolve(input.outputDirectory, 'latest');
  await fs.mkdir(latestDir, { recursive: true });

  const result: TestResult = {
    taskId: input.taskId,
    status: input.summary.failed > 0 ? 'failed' : 'passed',
    mode: input.mode,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    summary: input.summary,
    coverage: input.coverage,
    failures: input.failures,
  };

  const resultJsonPath = path.join(latestDir, 'result.json');
  await fs.writeFile(resultJsonPath, JSON.stringify(result, null, 2) + '\n', 'utf8');

  const summaryPath = path.join(latestDir, 'summary.md');
  await fs.writeFile(summaryPath, renderSummary(result), 'utf8');

  return {
    paths: { latestDir, resultJsonPath, summaryPath },
    result,
  };
}

export function renderSummary(result: TestResult): string {
  const lines: string[] = [];
  lines.push(`# 测试报告：${result.taskId}`);
  lines.push('');
  lines.push(`- 状态：**${result.status === 'passed' ? '通过' : '失败'}**`);
  lines.push(`- 模式：${result.mode === 'incremental' ? '增量' : '全量'}`);
  lines.push(`- 时间：${result.startedAt} → ${result.finishedAt}`);
  lines.push(`- 用例总数：${result.summary.total}`);
  lines.push(`- 通过：${result.summary.passed}，失败：${result.summary.failed}，跳过：${result.summary.skipped}`);
  lines.push(`- 耗时：${result.summary.durationMs}ms`);
  lines.push('');
  lines.push('## 验收标准覆盖');
  lines.push(`- 总数：${result.coverage.acceptanceCriteria}`);
  lines.push(`- 已覆盖：${result.coverage.covered}`);
  if (result.coverage.uncovered.length > 0) {
    lines.push('- 未覆盖：');
    for (const c of result.coverage.uncovered) lines.push(`  - ${c}`);
  }
  lines.push('');
  if (result.failures.length > 0) {
    lines.push('## 失败摘要');
    for (const f of result.failures) {
      lines.push(`- **${f.test}**（${f.category}，置信度 ${f.confidence}）：${f.message}`);
    }
    lines.push('');
  }
  lines.push('## 产物与报告路径');
  lines.push(`- result.json：${path.join('.auto-e2e', 'reports', 'latest', 'result.json')}`);
  lines.push(`- HTML 报告：${path.join('.auto-e2e', 'reports', 'latest', 'html', 'index.html')}`);
  lines.push('');
  return lines.join('\n');
}

/** 控制台摘要打印（非 JSON 模式）。 */
export function printConsoleSummary(result: TestResult, logger: Logger): void {
  const status = result.status === 'passed' ? '✅ 通过' : '❌ 失败';
  logger.info(`${status} | 用例 ${result.summary.total} | 通过 ${result.summary.passed} | 失败 ${result.summary.failed}`);
  if (result.failures.length > 0) {
    logger.warn(`失败 ${result.failures.length} 项：`);
    for (const f of result.failures) {
      logger.warn(`  - ${f.test}（${f.category}）：${f.message}`);
    }
  }
}
