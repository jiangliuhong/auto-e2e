import { describe, it, expect } from 'vitest';
import { analyzeLastRun } from '../../src/report/failure-analyzer.js';
import { MockPiClient } from '../../src/agent/mock-pi-client.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { TestResult } from '../../src/domain/test-result.js';

async function setupLatest(report: unknown, existing?: Partial<TestResult>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-analyze-'));
  const latestDir = path.join(root, 'latest');
  await fs.mkdir(latestDir, { recursive: true });
  await fs.writeFile(path.join(latestDir, 'playwright.json'), JSON.stringify(report));
  if (existing) {
    await fs.writeFile(
      path.join(latestDir, 'result.json'),
      JSON.stringify({ ...existing } as TestResult),
    );
  }
  return { root, latestDir };
}

const reportWithFailure = {
  suites: [
    {
      specs: [
        {
          title: '禁用用户',
          ok: false,
          tests: [
            {
              results: [
                {
                  status: 'failed',
                  duration: 100,
                  error: { message: 'timeout 30000ms exceeded', stack: 'at line 5' },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('failure-analyzer', () => {
  it('分类失败并写回 result.json，保留原始 summary', async () => {
    const { latestDir } = await setupLatest(reportWithFailure, {
      taskId: 'TASK-1',
      status: 'failed',
      mode: 'incremental',
      startedAt: '',
      finishedAt: '',
      summary: { total: 1, passed: 0, failed: 1, skipped: 0, durationMs: 100 },
      coverage: { acceptanceCriteria: 1, covered: 1, uncovered: [] },
      failures: [],
    });
    const r = await analyzeLastRun({
      latestDir,
      artifactDir: path.join(latestDir, 'artifacts'),
      client: new MockPiClient(),
    });
    expect(r.failures.length).toBe(1);
    // timeout 关键词 → environment_failure。
    expect(r.failures[0]!.category).toBe('environment_failure');
    expect(r.updatedResult).toBeDefined();
    // 写回的 result.json 保留原始 summary。
    const written = JSON.parse(await fs.readFile(path.join(latestDir, 'result.json'), 'utf8')) as TestResult;
    expect(written.summary.failed).toBe(1);
    expect(written.failures[0]!.category).toBe('environment_failure');
  });

  it('无 playwright.json 时返回空失败', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-empty-'));
    const r = await analyzeLastRun({
      latestDir: root,
      artifactDir: root,
      client: new MockPiClient(),
    });
    expect(r.failures).toEqual([]);
  });
});
