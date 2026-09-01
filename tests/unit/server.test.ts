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
    expect(html).toContain('data-nav-page="overview"');
    expect(html).toContain('data-nav-page="specs"');
    expect(html).toContain('data-nav-page="run"');
    expect(html).toContain('data-nav-page="reports"');
    expect(html).toContain('data-nav-page="settings"');
    expect(html).toContain('data-page-view="overview"');
    expect(html).toContain('id="manual-login"');
    expect(html).toContain('/manual-login');
    expect(html).toContain('id="live-view-frame"');
    expect(html).toContain('sandbox="allow-scripts allow-forms allow-pointer-lock allow-downloads"');
    expect(html).not.toContain('sandbox="allow-same-origin');
    expect(html).toContain('/run-jobs');
    expect(html).not.toContain("window.open('about:blank', '_blank')");
    expect(html).toContain("history.replaceState(null, '', '#/overview')");
    expect(html).toContain('body[data-page="reports"] main { overflow: hidden; }');
    expect(html).toContain('#detail-card #detail');
    expect(html).toContain('document.body.dataset.page = page');
    expect(html).not.toContain('class="workspace-banner"');
    expect(() => new Function(html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '')).not.toThrow();
  });

  it('从 serve 页面为当前 Profile 打开手动登录会话', async () => {
    await instance.stop();
    const fakeCli = path.join(root, 'fake-betterwright');
    await fs.writeFile(fakeCli, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('betterwright-calls.jsonl', JSON.stringify(args) + '\\n');
if (args[0] === 'view') {
  console.log('Live view: http://127.0.0.1:4567/?t=test-capability-token');
  const timer = setInterval(() => {}, 1000);
  const stop = () => { fs.appendFileSync('viewer-stops.log', 'stop\\n'); clearInterval(timer); process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} else if (args[0] === 'run') {
  process.stdin.resume();
  process.stdin.on('end', () => {
    process.stdout.write(JSON.stringify({ ok: true, result: { url: 'http://127.0.0.1:3000/' } }));
  });

} else {
  process.exit(1);
}
`, 'utf8');
    await fs.chmod(fakeCli, 0o700);
    instance = createAutoE2EServer({
      projectRoot: root,
      registryPath: path.join(root, 'workspaces.json'),
      betterwrightBinary: fakeCli,
      port: 0,
    });
    await instance.start();

    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const response = await fetch(`${instance.url}/api/workspaces/${workspaceId}/manual-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'http://127.0.0.1:3000',
        profile: 'qa-manual-auth',
        headed: false,
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      viewerUrl: expect.stringMatching(/^\/api\/live-views\/[0-9a-f-]+\/\?t=[0-9a-f-]+$/),
      targetUrl: 'http://127.0.0.1:3000/',
      profile: 'qa-manual-auth',
    });
    expect(body.viewerUrl).not.toContain('test-capability-token');
    const calls = (await fs.readFile(path.join(root, 'betterwright-calls.jsonl'), 'utf8'))
      .trim().split('\n').map((line) => JSON.parse(line));
    expect(calls).toEqual([
      ['view', '--profile', 'qa-manual-auth', '--session', 'demo-manual-login', '--expose', 'local'],
      ['run', '-', '--profile', 'qa-manual-auth', '--session', 'demo-manual-login'],
    ]);
  });

  it('异步运行验收并推送实际 Session 的 Live View', async () => {
    await instance.stop();
    const fakeCli = path.join(root, 'fake-betterwright-live-run');
    await fs.writeFile(fakeCli, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('live-run-calls.jsonl', JSON.stringify(args) + '\\n');
if (args[0] === 'view') {
  console.log('Live view: http://127.0.0.1:4568/?t=run-token');
  const timer = setInterval(() => {}, 1000);
  const stop = () => { fs.appendFileSync('viewer-stops.log', 'stop\\n'); clearInterval(timer); process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} else if (args[0] === 'exec') {
  process.stdin.resume();
  process.stdin.on('end', () => setTimeout(() => {
    const answer = JSON.stringify({
      summary: '通过',
      criteria: [{ id: 'AC-01', description: '显示结果', status: 'passed', actual: '已显示', proof: null }]
    });
    process.stdout.write(JSON.stringify({ ok: true, answer, steps: 1, proof: null }));
  }, 200));
} else if (args[0] === 'run') {
  process.stdin.resume();
  process.stdin.on('end', () => {
    process.stdout.write(JSON.stringify({ ok: true, result: { url: 'http://127.0.0.1:3000/' } }));
  });
} else {
  process.exit(1);
}
`, 'utf8');
    await fs.chmod(fakeCli, 0o700);
    instance = createAutoE2EServer({
      projectRoot: root,
      registryPath: path.join(root, 'workspaces.json'),
      betterwrightBinary: fakeCli,
      port: 0,
    });
    await instance.start();

    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const started = await fetch(`${instance.url}/api/workspaces/${workspaceId}/run-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:3000', profile: 'qa-live' }),
    });
    expect(started.status).toBe(202);
    const { jobId } = await started.json();
    const active = await fetch(
      `${instance.url}/api/workspaces/${workspaceId}/run-jobs/active`,
    ).then((response) => response.json());
    expect(active.job).toEqual({ id: jobId, status: 'running' });
    const conflictingManual = await fetch(`${instance.url}/api/workspaces/${workspaceId}/manual-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:3000', profile: 'qa-live' }),
    });
    expect(conflictingManual.status).toBe(409);
    const eventText = await fetch(
      `${instance.url}/api/workspaces/${workspaceId}/run-jobs/${jobId}/events`,
    ).then((response) => response.text());
    const events = eventText.trim().split('\n\n').map((entry) => {
      const data = entry.split('\n').find((line) => line.startsWith('data: '));
      return JSON.parse(data.slice('data: '.length));
    });
    expect(events.map((event) => event.type)).toEqual([
      'run-started', 'case-started', 'viewer-ready', 'case-completed', 'run-completed',
    ]);
    const viewerEvent = events.find((event) => event.type === 'viewer-ready');
    expect(viewerEvent).toEqual(expect.objectContaining({
      viewerUrl: expect.stringMatching(/^\/api\/live-views\/[0-9a-f-]+\/\?t=[0-9a-f-]+$/),
    }));
    expect(viewerEvent.viewerUrl).not.toContain('run-token');
    expect(events.at(-1).run.status).toBe('passed');

    const replayText = await fetch(
      `${instance.url}/api/workspaces/${workspaceId}/run-jobs/${jobId}/events`,
      { headers: { 'Last-Event-ID': '3' } },
    ).then((response) => response.text());
    expect(replayText.match(/^data: /gm)).toHaveLength(2);
    expect(replayText).toContain('"eventId":4');
    expect(replayText).toContain('"eventId":5');

    const calls = (await fs.readFile(path.join(root, 'live-run-calls.jsonl'), 'utf8'))
      .trim().split('\n').map((line) => JSON.parse(line));
    expect(calls[0]).toEqual(expect.arrayContaining(['view', '--profile', 'qa-live', '--session']));
    expect(calls[1][0]).toBe('exec');
    expect(calls[0][calls[0].indexOf('--session') + 1]).toBe(calls[1][calls[1].indexOf('--session') + 1]);

    const manualResponse = await fetch(`${instance.url}/api/workspaces/${workspaceId}/manual-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:3000', profile: 'qa-live' }),
    });
    expect(manualResponse.status).toBe(200);
    expect((await fs.readFile(path.join(root, 'viewer-stops.log'), 'utf8')).trim().split('\n')).toHaveLength(1);
  });

  it('关闭服务时取消并等待后台验收任务', async () => {
    await instance.stop();
    const fakeCli = path.join(root, 'fake-betterwright-cancellable');
    await fs.writeFile(fakeCli, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'view') {
  console.log('Live view: http://127.0.0.1:4569/?t=cancel-token');
  const timer = setInterval(() => {}, 1000);
  process.on('SIGTERM', () => { clearInterval(timer); process.exit(0); });
} else if (args[0] === 'exec') {
  fs.writeFileSync('exec-started', 'yes');
  const timer = setInterval(() => {}, 1000);
  process.on('SIGINT', () => {
    fs.writeFileSync('exec-cancelled', 'yes');
    clearInterval(timer);
    process.exit(130);
  });
  process.stdin.resume();
} else {
  process.exit(1);
}
`, 'utf8');
    await fs.chmod(fakeCli, 0o700);
    instance = createAutoE2EServer({
      projectRoot: root,
      registryPath: path.join(root, 'workspaces.json'),
      betterwrightBinary: fakeCli,
      port: 0,
    });
    await instance.start();
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const started = await fetch(`${instance.url}/api/workspaces/${workspaceId}/run-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:3000' }),
    });
    expect(started.status).toBe(202);

    const marker = path.join(root, 'exec-started');
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        await fs.access(marker);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    await expect(fs.access(marker)).resolves.toBeUndefined();
    await instance.stop();
    await expect(fs.readFile(path.join(root, 'exec-cancelled'), 'utf8')).resolves.toBe('yes');
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

  it('通过工作区接口创建和读取 Spec Bundle', async () => {
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const spec = {
      schemaVersion: 2,
      taskId: 'BUNDLE-01',
      title: 'Bundle 用例',
      requirement: '完成业务操作并检查结果',
      steps: [{ id: 'STEP-01', instruction: '完成操作', expected: '操作成功' }],
      results: [{ id: 'RESULT-01', name: '结果', actual: '页面结果', expected: '成功', match: 'equals' }],
    };
    const response = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/new-bundle`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec }),
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(await fs.readFile(
      path.join(root, '.auto-e2e', 'specs', 'new-bundle', 'spec.json'),
      'utf8',
    )).taskId).toBe('BUNDLE-01');

    const listed = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs`).then((item) => item.json());
    expect(listed.specs).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName: 'new-bundle', reference: '.auto-e2e/specs/new-bundle/spec.json' }),
    ]));
    const loaded = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/new-bundle`).then((item) => item.json());
    expect(loaded.spec.title).toBe('Bundle 用例');
  });

  it('Web API 可以读取和更新嵌套的旧版 Spec', async () => {
    const nested = path.join(root, '.auto-e2e', 'specs', 'legacy');
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(path.join(nested, 'nested.spec.json'), JSON.stringify({
      title: '嵌套旧用例', requirement: '可以读取', acceptanceCriteria: ['显示结果'],
    }), 'utf8');
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const encoded = encodeURIComponent('legacy/nested.spec.json');
    const loaded = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/${encoded}`).then((response) => response.json());
    expect(loaded.spec.title).toBe('嵌套旧用例');

    const response = await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/${encoded}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec: { ...loaded.spec, title: '已更新' } }),
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(await fs.readFile(path.join(nested, 'nested.spec.json'), 'utf8')).title).toBe('已更新');
  });

  it('通过工作区接口上传、列出和删除 Bundle 资源', async () => {
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const spec = {
      schemaVersion: 2,
      taskId: 'FILES-01',
      title: '资源用例',
      requirement: '上传并校验文件',
      files: [{ id: 'input', role: 'input', path: 'inputs/data.xlsx' }],
      steps: [{ id: 'STEP-01', instruction: '上传文件', uses: ['input'], expected: '上传成功' }],
      results: [{ id: 'RESULT-01', name: '结果', actual: '状态', expected: '成功', match: 'equals' }],
    };
    await fetch(`${instance.url}/api/workspaces/${workspaceId}/task-specs/files`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spec }),
    });
    const base = `${instance.url}/api/workspaces/${workspaceId}/task-specs/files/resources`;
    const upload = await fetch(`${base}/${encodeURIComponent('inputs/data.xlsx')}`, {
      method: 'PUT', body: Buffer.from('xlsx-data'),
    });
    expect(upload.status).toBe(200);
    expect(await fs.readFile(path.join(root, '.auto-e2e', 'specs', 'files', 'inputs', 'data.xlsx'), 'utf8')).toBe('xlsx-data');
    const listed = await fetch(base).then((response) => response.json());
    expect(listed.files).toEqual([{ path: 'inputs/data.xlsx', size: 9 }]);

    expect((await fetch(`${base}/${encodeURIComponent('../secret.txt')}`, {
      method: 'PUT', body: Buffer.from('secret'),
    })).status).toBe(400);
    expect((await fetch(`${base}/${encodeURIComponent('inputs/data.xlsx')}`, { method: 'DELETE' })).status).toBe(200);
    await expect(fs.access(path.join(root, '.auto-e2e', 'specs', 'files', 'inputs', 'data.xlsx'))).rejects.toThrow();
  });

  it('Bundle 资源接口拒绝通过符号链接写出 Bundle', async () => {
    const workspaces = await fetch(`${instance.url}/api/workspaces`).then((response) => response.json());
    const workspaceId = workspaces.workspaces[0].id;
    const bundle = path.join(root, '.auto-e2e', 'specs', 'linked');
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-resource-outside-'));
    await fs.mkdir(bundle, { recursive: true });
    await fs.writeFile(path.join(bundle, 'spec.json'), JSON.stringify({
      schemaVersion: 2, taskId: 'LINK-01', title: '链接', requirement: '链接',
      steps: [{ id: 'STEP-01', instruction: '检查', expected: '安全' }],
      results: [{ id: 'RESULT-01', name: '结果', actual: '状态', expected: '安全', match: 'equals' }],
    }), 'utf8');
    await fs.symlink(outside, path.join(bundle, 'inputs'));
    try {
      const response = await fetch(
        `${instance.url}/api/workspaces/${workspaceId}/task-specs/linked/resources/${encodeURIComponent('inputs/escape.txt')}`,
        { method: 'PUT', body: Buffer.from('secret') },
      );
      expect(response.status).toBe(400);
      await expect(fs.access(path.join(outside, 'escape.txt'))).rejects.toThrow();
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});
