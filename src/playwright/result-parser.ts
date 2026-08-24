/**
 * Playwright JSON 结果解析（plan §13）。
 *
 * Playwright 的 JSON reporter 输出一个对象：
 * {
 *   config: {...},
 *   suites: [ { suites: [...], spec: [...] } ],
 *   errors: [...],
 *   stats: { duration, expected, unexpected, flaky }
 * }
 * 每个 Suites 树叶子节点是 spec.results。
 *
 * 本解析器把整棵树展平为 spec 维度的统计与失败条目。
 */
import type { TestSummary, FailureEntry, Coverage } from '../domain/test-result.js';

/** Playwright JSON 中 spec 的最小结构。 */
export interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests?: Array<{
    timeout?: number;
    annotations?: Array<{ type?: string; description?: string }>;
    results?: Array<{
      status: 'passed' | 'failed' | 'timedOut' | 'interrupted' | 'skipped' | 'flaky';
      duration: number;
      error?: { message?: string; snippet?: string; stack?: string };
      retry?: number;
      attachments?: Array<{ name?: string; contentType?: string; path?: string }>;
    }>;
  }>;
}

export interface PlaywrightJsonReport {
  config?: unknown;
  suites?: unknown[];
  errors?: Array<{ message?: string }>;
  stats?: {
    startTime?: number;
    duration?: number;
    expected?: number;
    unexpected?: number;
    flaky?: number;
  };
}

export interface ParsedTestResult {
  summary: TestSummary;
  /** 失败的测试条目（原始信息，未分类）。 */
  rawFailures: Array<{
    test: string;
    message: string;
    stack?: string;
    artifacts?: { screenshot?: string; trace?: string; video?: string };
  }>;
  /** 整体 duration（ms）。 */
  durationMs: number;
}

/** 递归收集所有叶子 spec。 */
export function collectSpecs(report: PlaywrightJsonReport): PlaywrightSpec[] {
  const specs: PlaywrightSpec[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (Array.isArray(n['specs'])) {
      for (const s of n['specs'] as unknown[]) {
        if (s && typeof s === 'object') specs.push(s as PlaywrightSpec);
      }
    }
    if (Array.isArray(n['suites'])) {
      for (const child of n['suites'] as unknown[]) visit(child);
    }
  };
  if (Array.isArray(report.suites)) {
    for (const s of report.suites) visit(s);
  }
  return specs;
}

export function parsePlaywrightJson(report: PlaywrightJsonReport): ParsedTestResult {
  const specs = collectSpecs(report);
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let durationMs = 0;
  const rawFailures: ParsedTestResult['rawFailures'] = [];

  for (const spec of specs) {
    const tests = spec.tests ?? [];
    if (tests.length === 0) {
      // 无 test 结果的 spec 计入总数，状态用 spec.ok 推断。
      total++;
      if (spec.ok) passed++;
      else failed++;
      continue;
    }
    for (const test of tests) {
      const results = test.results ?? [];
      const lastResult = results[results.length - 1];
      total++;
      durationMs += lastResult?.duration ?? 0;
      const status = lastResult?.status ?? 'skipped';
      if (status === 'passed' || status === 'flaky') {
        passed++;
      } else if (status === 'skipped') {
        skipped++;
      } else {
        failed++;
        rawFailures.push({
          test: spec.title,
          message: lastResult?.error?.message ?? '测试失败',
          stack: lastResult?.error?.stack ?? lastResult?.error?.snippet,
          artifacts: collectExistingArtifacts(lastResult?.attachments),
        });
      }
    }
  }

  return {
    summary: { total, passed, failed, skipped, durationMs },
    rawFailures,
    durationMs,
  };
}

function collectExistingArtifacts(
  attachments?: Array<{ name?: string; contentType?: string; path?: string }>,
): { screenshot?: string; trace?: string; video?: string } | undefined {
  if (!attachments) return undefined;
  const result: { screenshot?: string; trace?: string; video?: string } = {};
  for (const item of attachments) {
    if (!item.path) continue;
    const name = `${item.name ?? ''} ${item.contentType ?? ''}`.toLowerCase();
    if (!result.screenshot && /screenshot|image\//.test(name)) result.screenshot = item.path;
    else if (!result.trace && /trace|zip/.test(name)) result.trace = item.path;
    else if (!result.video && /video\//.test(name)) result.video = item.path;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** 根据测试用例与验收标准计算覆盖。 */
export function computeCoverage(
  acceptanceCriteria: string[],
  mappedCriteria: string[],
): Coverage {
  const normalizedMappings = new Set(mappedCriteria.map((value) => value.trim().toLowerCase()));
  const covered: string[] = [];
  const uncovered: string[] = [];
  for (const criteria of acceptanceCriteria) {
    const hit = normalizedMappings.has(criteria.trim().toLowerCase());
    if (hit) covered.push(criteria);
    else uncovered.push(criteria);
  }
  return {
    acceptanceCriteria: acceptanceCriteria.length,
    covered: covered.length,
    uncovered,
  };
}

/** 占位类型，失败条目由 failure-analyzer 填充。 */
export type { FailureEntry };
