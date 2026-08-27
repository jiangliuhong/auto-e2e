import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AcceptanceHistoryStore } from '../../src/acceptance/history-store.js';
import { createAutoE2EServer, type AutoE2EServerInstance } from '../../src/server/server.js';

describe('acceptance report server', () => {
  let root: string;
  let instance: AutoE2EServerInstance;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-server-'));
    await fs.writeFile(path.join(root, '.auto-e2e.yaml'), `project:
  name: demo
  baseUrl: http://127.0.0.1:3000
`, 'utf8');
    await fs.mkdir(path.join(root, '.auto-e2e'), { recursive: true });
    await fs.writeFile(path.join(root, '.auto-e2e', 'task-spec.json'), JSON.stringify({
      title: '查询',
      requirement: '可以查询',
      acceptanceCriteria: ['显示结果'],
    }), 'utf8');
    instance = createAutoE2EServer({
      projectRoot: root,
      registryPath: path.join(root, 'workspaces.json'),
      port: 0,
    });
    await instance.start();
  });

  afterEach(async () => {
    await instance.stop();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('呈现工作区与主题控制', async () => {
    const html = await fetch(instance.url).then((response) => response.text());
    expect(html).toContain('工作区');
    expect(html).toContain('切换为亮色');
    expect(html).toContain('.auto-e2e/task-spec.json');
    expect(() => new Function(html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '')).not.toThrow();
  });

  it('返回历史与逐条验收详情', async () => {
    const runId = '20260826T120000000Z-a1b2c3d4';
    await new AcceptanceHistoryStore(root).save({
      schemaVersion: 1, runId, project: 'demo',
      source: { type: 'task-spec', reference: 'task-spec.json', title: '查询', content: '可以查询' },
      commit: null, targetUrl: 'http://127.0.0.1:3000', profile: 'test', model: 'test', session: 'test',
      status: 'passed', startedAt: '2026-08-26T12:00:00.000Z', finishedAt: '2026-08-26T12:00:01.000Z', durationMs: 1000,
      summary: '通过', criteria: [{ id: 'AC-01', description: '显示结果', status: 'passed', actual: '已显示', proof: null }],
      steps: 1, proof: null, error: null,
    });
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const list = await fetch(`${instance.url}/api/workspaces/${workspaceId}/runs`).then((response) => response.json());
    const show = await fetch(`${instance.url}/api/workspaces/${workspaceId}/runs/${runId}`).then((response) => response.json());
    expect(list.runs).toHaveLength(1);
    expect(show.run.criteria[0].status).toBe('passed');
  });

  it('通过工作区接口读取并更新任务规格', async () => {
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const current = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-spec`).then((response) => response.json());
    expect(current.spec.title).toBe('查询');

    const updated = {
      title: '筛选',
      requirement: '可以筛选',
      acceptanceCriteria: ['显示筛选结果'],
    };
    const response = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-spec`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec: updated }),
    });
    expect(response.status).toBe(200);
    const saved = JSON.parse(await fs.readFile(path.join(root, '.auto-e2e', 'task-spec.json'), 'utf8'));
    expect(saved.title).toBe('筛选');
  });
});
