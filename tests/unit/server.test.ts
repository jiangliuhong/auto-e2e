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
    await fs.mkdir(path.join(root, '.auto-e2e', 'specs'), { recursive: true });
    await fs.writeFile(path.join(root, '.auto-e2e', 'specs', 'query.spec.json'), JSON.stringify({
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
    expect(html).toContain('.auto-e2e/specs/');
    expect(html).toContain('运行全部用例');
    expect(html).toContain('id="header-ws-path"');
    expect(html).toContain('id="header-ws-url"');
    expect(html).toContain('id="header-ws-url-link"');
    expect(html).not.toContain('class="workspace-banner"');
    expect(() => new Function(html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '')).not.toThrow();
  });

  it('返回历史与逐条验收详情', async () => {
    const runId = '20260826T120000000Z-a1b2c3d4';
    await new AcceptanceHistoryStore(root).save({
      schemaVersion: 1, runId, project: 'demo',
      source: { type: 'task-spec', reference: '.auto-e2e/specs/query.spec.json', title: '查询', content: '可以查询' },
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
    const current = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/query.spec.json`).then((response) => response.json());
    expect(current.spec.title).toBe('查询');

    const updated = {
      title: '筛选',
      requirement: '可以筛选',
      acceptanceCriteria: ['显示筛选结果'],
    };
    const response = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/query.spec.json`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec: updated }),
    });
    expect(response.status).toBe(200);
    const saved = JSON.parse(await fs.readFile(path.join(root, '.auto-e2e', 'specs', 'query.spec.json'), 'utf8'));
    expect(saved.title).toBe('筛选');
    expect((await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-spec`)).status).toBe(404);
  });

  it('通过工作区接口读取并更新工作区配置', async () => {
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const initial = await fetch(`${instance.url}/api/workspaces/${workspaceId}`).then((response) => response.json());
    expect(initial.config.project.name).toBe('demo');

    const updatedConfig = {
      ...initial.config,
      project: {
        name: 'new-app',
        baseUrl: 'http://127.0.0.1:8080',
      },
    };
    const response = await fetch(`${instance.url}/api/workspaces/${workspaceId}/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: updatedConfig }),
    });
    expect(response.status).toBe(200);

    const reloaded = await fetch(`${instance.url}/api/workspaces/${workspaceId}`).then((response) => response.json());
    expect(reloaded.config.project.name).toBe('new-app');
    expect(reloaded.config.project.baseUrl).toBe('http://127.0.0.1:8080');
    expect(reloaded.workspace.name).toBe('new-app');
  });

  it('通过工作区接口管理多个验收用例文件', async () => {
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    for (const [fileName, title] of [['query-existing.spec.json', '有结果'], ['query-empty.spec.json', '无结果']]) {
      const response = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/${fileName}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spec: { title, requirement: `查询${title}`, acceptanceCriteria: ['显示预期状态'] } }),
      });
      expect(response.status).toBe(200);
    }
    await fs.writeFile(
      path.join(root, '.auto-e2e', 'specs', 'invalid.spec.json'),
      '{"title":"待修复"}',
      'utf8',
    );
    const list = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs`).then((response) => response.json());
    expect(list.specs.map((item: { fileName: string }) => item.fileName)).toEqual([
      'invalid.spec.json',
      'query-empty.spec.json',
      'query-existing.spec.json',
      'query.spec.json',
    ]);
    expect(list.specs[0].error).toContain('requirement');
    const saved = JSON.parse(await fs.readFile(
      path.join(root, '.auto-e2e', 'specs', 'query-existing.spec.json'),
      'utf8',
    ));
    expect(saved.title).toBe('有结果');

    const deleted = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/query-empty.spec.json`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/invalid.spec.json`, { method: 'DELETE' });
    expect((await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs`).then((response) => response.json())).specs).toHaveLength(2);
  });
});
