import { describe, it, expect } from 'vitest';
import { collectSpecs, parsePlaywrightJson, computeCoverage } from '../../src/playwright/result-parser.js';

const report = {
  suites: [
    {
      suites: [
        {
          specs: [
            {
              title: '用例 A',
              ok: true,
              tests: [{ results: [{ status: 'passed', duration: 100 }] }],
            },
            {
              title: '用例 B',
              ok: false,
              tests: [
                { results: [{ status: 'failed', duration: 200, error: { message: 'boom' } }] },
              ],
            },
          ],
        },
      ],
      specs: [
        {
          title: '用例 C',
          ok: true,
          tests: [{ results: [{ status: 'skipped', duration: 0 }] }],
        },
      ],
    },
  ],
};

describe('result-parser', () => {
  it('collectSpecs 递归收集叶子 spec', () => {
    const specs = collectSpecs(report);
    // 遍历顺序：父节点 specs 先于嵌套 suites（与实现一致）。
    expect(specs.map((s) => s.title).sort()).toEqual(['用例 A', '用例 B', '用例 C']);
  });

  it('parsePlaywrightJson 统计 passed/failed/skipped 与失败条目', () => {
    const r = parsePlaywrightJson(report);
    expect(r.summary.total).toBe(3);
    expect(r.summary.passed).toBe(1);
    expect(r.summary.failed).toBe(1);
    expect(r.summary.skipped).toBe(1);
    expect(r.rawFailures.length).toBe(1);
    expect(r.rawFailures[0]!.test).toBe('用例 B');
    expect(r.rawFailures[0]!.message).toBe('boom');
  });

  it('computeCoverage 按标题包含关系判定覆盖', () => {
    const cov = computeCoverage(
      ['展示禁用按钮', '二次确认'],
      ['正向：展示禁用按钮', '其他'],
    );
    expect(cov.covered).toBe(1);
    expect(cov.uncovered).toEqual(['二次确认']);
  });
});
