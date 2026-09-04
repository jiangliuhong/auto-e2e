import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AcceptanceRun } from '../../src/domain/acceptance-run.js';
import { exportAcceptanceReport } from '../../src/server/report-export.js';

describe('report export', () => {
  let root: string;
  let artifactDirectory: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-export-'));
    artifactDirectory = path.join(root, 'artifacts');
    await fs.mkdir(path.join(artifactDirectory, 'run'), { recursive: true });
    await fs.writeFile(path.join(artifactDirectory, 'run', 'proof.png'), Buffer.from([137, 80, 78, 71]));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it.each(['html', 'markdown'] as const)('生成可独立阅读且内嵌 proof 的 %s 报告', async (format) => {
    const run: AcceptanceRun = {
      schemaVersion: 1,
      runId: '20260904T010203004Z-a1b2c3d4',
      project: 'demo',
      source: {
        type: 'task-spec', reference: 'query.spec.json', title: '查询 <script>alert(1)</script>',
        content: '用户可以查询订单',
      },
      commit: null,
      targetUrl: 'http://127.0.0.1:3000',
      profile: 'default',
      model: 'test',
      session: 'session',
      status: 'passed',
      startedAt: '2026-09-04T01:02:03.004Z',
      finishedAt: '2026-09-04T01:02:04.004Z',
      durationMs: 1000,
      summary: '全部通过',
      criteria: [{
        id: 'AC-01', description: '显示订单', status: 'passed', actual: '已显示',
        proof: path.join(artifactDirectory, 'run', 'proof.png'),
      }],
      steps: 1,
      proof: null,
      error: null,
    };

    const content = await exportAcceptanceReport(run, format, { projectRoot: root, artifactDirectory });
    expect(content).toContain('data:image/png;base64,iVBORw==');
    expect(content).toContain('AC-01');
    if (format === 'html') {
      expect(content).toContain('查询 &lt;script&gt;alert(1)&lt;/script&gt;');
      expect(content).not.toContain('查询 <script>alert(1)</script>');
    } else {
      expect(content).toContain('# 查询 &lt;script&gt;alert\\(1\\)&lt;/script&gt;');
    }
  });

  it('结构化套件完整导出步骤、断言和错误，并拒绝打包 artifact 根目录外的文件', async () => {
    const outside = path.join(root, 'secret.png');
    await fs.writeFile(outside, 'secret');
    const run: AcceptanceRun = {
      schemaVersion: 2,
      runId: '20260904T010203004Z-a1b2c3d4',
      project: 'demo',
      source: { type: 'task-spec', reference: 'suite', title: '套件', content: '运行全部用例' },
      commit: 'abc123', targetUrl: 'http://127.0.0.1:3000', profile: 'default', model: 'test',
      status: 'failed', startedAt: '2026-09-04T01:02:03.004Z', finishedAt: '2026-09-04T01:02:05.004Z',
      durationMs: 2000, summary: '一个断言失败', steps: 1, proof: null, error: null,
      cases: [{
        caseId: 'CASE-01',
        source: { type: 'task-spec', reference: 'case', title: '查询', content: '查询订单' },
        session: 'session', status: 'failed', startedAt: '2026-09-04T01:02:03.004Z',
        finishedAt: '2026-09-04T01:02:05.004Z', durationMs: 2000, summary: '金额不符',
        criteria: [{ id: 'AC-01', description: '金额正确', status: 'failed', actual: '99', proof: outside }],
        workflowSteps: [{ id: 'STEP-01', instruction: '打开订单', expected: '显示详情', status: 'passed', actual: '已显示', proof: null, error: null }],
        resultAssertions: [{ id: 'RESULT-01', name: '订单金额', status: 'failed', expected: 100, actual: 99, match: 'numeric', difference: 1, proof: outside, error: '金额不符' }],
        steps: 1, proof: null, error: '金额不符',
      }],
    };

    const html = await exportAcceptanceReport(run, 'html', { projectRoot: root, artifactDirectory });
    expect(html).toContain('CASE-01');
    expect(html).toContain('STEP-01');
    expect(html).toContain('RESULT-01');
    expect(html).toContain('金额不符');
    expect(html).toContain('RESULT-01 截图证据不可用');
    expect(html).not.toContain(Buffer.from('secret').toString('base64'));
  });
});
