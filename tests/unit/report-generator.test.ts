import { describe, it, expect } from 'vitest';
import { generateReport, renderSummary } from '../../src/report/report-generator.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { TestResult } from '../../src/domain/test-result.js';

describe('report-generator', () => {
  it('生成 result.json 与 summary.md', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-report-'));
    const { paths, result } = await generateReport({
      taskId: 'TASK-1',
      mode: 'incremental',
      startedAt: '2026-07-29T03:00:00.000Z',
      finishedAt: '2026-07-29T03:01:00.000Z',
      summary: { total: 3, passed: 2, failed: 1, skipped: 0, durationMs: 60000 },
      coverage: { acceptanceCriteria: 2, covered: 2, uncovered: [] },
      failures: [
        {
          test: '用例 B',
          category: 'product_defect',
          message: '禁用失败',
          confidence: 0.9,
        },
      ],
      outputDirectory: dir,
    });
    const resultJson = JSON.parse(await fs.readFile(paths.resultJsonPath, 'utf8')) as TestResult;
    expect(resultJson.status).toBe('failed');
    expect(resultJson.summary.failed).toBe(1);
    expect(resultJson.failures[0]!.category).toBe('product_defect');

    const summary = await fs.readFile(paths.summaryPath, 'utf8');
    expect(summary).toContain('TASK-1');
    expect(summary).toContain('失败');
    expect(summary).toContain('product_defect');
    expect(result.summary.failed).toBe(1);
  });

  it('renderSummary 全通过时不含失败摘要', () => {
    const md = renderSummary({
      taskId: 'T',
      status: 'passed',
      mode: 'incremental',
      startedAt: '',
      finishedAt: '',
      summary: { total: 1, passed: 1, failed: 0, skipped: 0, durationMs: 0 },
      coverage: { acceptanceCriteria: 1, covered: 1, uncovered: [] },
      failures: [],
    });
    expect(md).toContain('通过');
    expect(md).not.toContain('失败摘要');
  });
});
