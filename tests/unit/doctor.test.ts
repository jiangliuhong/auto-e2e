import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { doctorCommand } from '../../src/commands/doctor.js';
import { runDoctor } from '../../src/doctor/doctor.js';

const createdRoots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(createdRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('doctor tool checks', () => {
  it('校验 BetterWright 并保留非阻塞 warning', async () => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root, doctorJson({
      ready: true,
      checks: [
        { group: 'Built-in agent', label: 'Model backends', status: 'ok', detail: 'codex (signed in)' },
        { group: 'Agent integration', label: 'MCP SDK', status: 'warn', detail: 'not installed' },
      ],
    }));
    const report = await runDoctor({ projectRoot: root, scope: 'tool', betterwrightBinary: binary });
    expect(report.ok, JSON.stringify(report, null, 2)).toBe(true);
    expect(report.groups.tool?.status).toBe('warn');
    expect(report.groups.project).toBeUndefined();
    expect(report.groups.tool?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tool.node', status: 'pass' }),
      expect.objectContaining({ id: 'tool.sqlite', status: 'pass' }),
      expect.objectContaining({ id: 'tool.betterwright', status: 'pass' }),
      expect.objectContaining({ label: 'Agent integration / MCP SDK', status: 'warn' }),
    ]));
  });

  it('把缺失模型后端升级为阻塞失败', async () => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root, doctorJson({
      ready: true,
      checks: [{
        group: 'Built-in agent', label: 'Model backends', status: 'warn', detail: 'none configured',
      }],
    }));
    const report = await runDoctor({ projectRoot: root, scope: 'tool', betterwrightBinary: binary });
    expect(report.ok).toBe(false);
    expect(report.groups.tool?.checks).toContainEqual(expect.objectContaining({
      label: 'Built-in agent / Model backends', status: 'fail',
    }));
  });

  it.each([
    ['非法 JSON', 'not-json'],
    ['缺少核心字段', JSON.stringify({ ready: true })],
  ])('%s 时返回 BetterWright fail', async (_name, output) => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root, output);
    const report = await runDoctor({ projectRoot: root, scope: 'tool', betterwrightBinary: binary });
    expect(report.ok).toBe(false);
    expect(report.groups.tool?.checks).toContainEqual(expect.objectContaining({
      id: 'tool.betterwright', status: 'fail',
    }));
  });

  it('BetterWright ready=false 时阻塞', async () => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root, doctorJson({
      ready: false,
      checks: [{ group: 'Built-in agent', label: 'Model backends', status: 'ok', detail: 'codex' }],
    }));
    const report = await runDoctor({ projectRoot: root, scope: 'tool', betterwrightBinary: binary });
    expect(report.groups.tool?.checks).toContainEqual(expect.objectContaining({
      id: 'tool.betterwright', status: 'fail',
    }));
  });

  it('BetterWright 非零退出时阻塞', async () => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root, 'setup required', 2);
    const report = await runDoctor({ projectRoot: root, scope: 'tool', betterwrightBinary: binary });
    expect(report.ok).toBe(false);
    expect(report.groups.tool?.checks).toContainEqual(expect.objectContaining({
      id: 'tool.betterwright', status: 'fail', detail: expect.stringContaining('setup required'),
    }));
  });

  it('默认执行 tool 和 project 两组', async () => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root, doctorJson({
      ready: true,
      checks: [{ group: 'Built-in agent', label: 'Model backends', status: 'ok', detail: 'codex' }],
    }));
    const report = await runDoctor({ projectRoot: root, betterwrightBinary: binary, fetch: okFetch });
    expect(report.scope).toBe('all');
    expect(report.groups.tool).toBeDefined();
    expect(report.groups.project).toBeDefined();
  });

  it('--json 只输出结构化 doctor 报告', async () => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root, doctorJson({
      ready: true,
      checks: [{ group: 'Built-in agent', label: 'Model backends', status: 'ok', detail: 'codex' }],
    }));
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(await doctorCommand({ tool: true, json: true, projectRoot: root, betterwrightBinary: binary })).toBe(0);
    const payload = JSON.parse(stdout.mock.calls.map(([chunk]) => String(chunk)).join('')) as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({ ok: true, scope: 'tool' }));
  });

  it('拒绝同时指定 --tool 与 --project', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(await doctorCommand({ tool: true, project: true, json: true })).toBe(3);
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('--tool 与 --project'));
  });
});

describe('doctor project checks', () => {
  it('缺少配置和规格时仅 warning，且不创建正式目录', async () => {
    const root = await temporaryRoot();
    const report = await runDoctor({
      projectRoot: root,
      scope: 'project',
      fetch: okFetch,
    });
    expect(report.ok, JSON.stringify(report, null, 2)).toBe(true);
    expect(report.groups.project?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'project.config', status: 'warn' }),
      expect.objectContaining({ id: 'project.specs', status: 'warn' }),
      expect.objectContaining({ id: 'project.inputs', status: 'skip' }),
      expect.objectContaining({ id: 'project.target', status: 'pass' }),
    ]));
    await expect(fs.stat(path.join(root, '.auto-e2e'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('校验合法配置、规格、输入文件和存储路径', async () => {
    const root = await configuredProject();
    await fs.mkdir(path.join(root, '.auto-e2e', 'specs'), { recursive: true });
    await fs.mkdir(path.join(root, 'fixtures'));
    await fs.writeFile(path.join(root, 'fixtures', 'input.csv'), 'value\n1\n');
    await writeSpec(root, 'valid.spec.json', {
      taskId: 'VALID',
      title: '合法用例',
      requirement: '读取输入',
      acceptanceCriteria: ['显示结果'],
      inputs: [{ name: '输入', path: 'fixtures/input.csv' }],
    });
    const report = await runDoctor({ projectRoot: root, scope: 'project', fetch: okFetch });
    expect(report.ok, JSON.stringify(report, null, 2)).toBe(true);
    expect(report.groups.project?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'project.config', status: 'pass' }),
      expect.objectContaining({ id: 'project.storage.database', status: 'pass' }),
      expect.objectContaining({ id: 'project.specs', status: 'pass' }),
      expect.objectContaining({ id: 'project.inputs', status: 'pass' }),
    ]));
    expect((await fs.readdir(root)).some((name) => name.startsWith('.auto-e2e-doctor-'))).toBe(false);
  });

  it('配置失败后跳过依赖检查', async () => {
    const root = await temporaryRoot();
    await fs.writeFile(path.join(root, '.auto-e2e.yaml'), 'project: [invalid\n');
    const report = await runDoctor({ projectRoot: root, scope: 'project', fetch: okFetch });
    expect(report.ok).toBe(false);
    expect(report.groups.project?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'project.config', status: 'fail' }),
      expect.objectContaining({ id: 'project.target', status: 'skip' }),
    ]));
  });

  it('拒绝非 HTTP URL 和被文件占用的存储父路径', async () => {
    const root = await configuredProject({ baseUrl: 'ftp://example.com', reportPath: 'occupied/reports' });
    await fs.writeFile(path.join(root, 'occupied'), 'file');
    const report = await runDoctor({ projectRoot: root, scope: 'project', fetch: okFetch });
    expect(report.ok).toBe(false);
    expect(report.groups.project?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'project.url', status: 'fail' }),
      expect.objectContaining({ id: 'project.storage.report', status: 'fail' }),
      expect.objectContaining({ id: 'project.target', status: 'skip' }),
    ]));
  });

  it('拒绝重复 taskId 和逃逸项目的输入符号链接', async () => {
    const root = await configuredProject();
    const outside = await temporaryRoot();
    await fs.mkdir(path.join(root, '.auto-e2e', 'specs'), { recursive: true });
    await fs.mkdir(path.join(root, 'fixtures'));
    await fs.writeFile(path.join(outside, 'secret.csv'), 'secret');
    await fs.symlink(path.join(outside, 'secret.csv'), path.join(root, 'fixtures', 'linked.csv'));
    const base = {
      taskId: 'DUPLICATE', title: '用例', requirement: '需求', acceptanceCriteria: ['结果'],
      inputs: [{ name: '输入', path: 'fixtures/linked.csv' }],
    };
    await writeSpec(root, 'one.spec.json', base);
    await writeSpec(root, 'two.spec.json', base);
    let report = await runDoctor({ projectRoot: root, scope: 'project', fetch: okFetch });
    expect(report.groups.project?.checks).toContainEqual(expect.objectContaining({ id: 'project.specs', status: 'fail' }));

    await fs.rm(path.join(root, '.auto-e2e', 'specs', 'two.spec.json'));
    report = await runDoctor({ projectRoot: root, scope: 'project', fetch: okFetch });
    expect(report.groups.project?.checks).toContainEqual(expect.objectContaining({ id: 'project.inputs', status: 'fail' }));
  });

  it.each([
    [200, 'pass'],
    [302, 'pass'],
    [401, 'warn'],
    [500, 'fail'],
  ] as const)('把 HTTP %s 映射为 %s', async (status, expected) => {
    const root = await configuredProject();
    const fetchStub = vi.fn(async () => new Response('', { status })) as unknown as typeof fetch;
    const report = await runDoctor({ projectRoot: root, scope: 'project', fetch: fetchStub });
    expect(report.groups.project?.checks).toContainEqual(expect.objectContaining({
      id: 'project.target', status: expected,
    }));
  });

  it('连接错误不泄漏 URL 中的凭据', async () => {
    const root = await configuredProject({ baseUrl: 'https://user:secret@example.com' });
    const failingFetch = vi.fn(async () => { throw new Error('failed https://user:secret@example.com'); }) as unknown as typeof fetch;
    const report = await runDoctor({ projectRoot: root, scope: 'project', fetch: failingFetch });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('user:secret');
    expect(serialized).toContain('***:***');
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-doctor-'));
  createdRoots.push(root);
  return root;
}

async function configuredProject(options: { baseUrl?: string; reportPath?: string } = {}): Promise<string> {
  const root = await temporaryRoot();
  await fs.writeFile(path.join(root, '.auto-e2e.yaml'), `project:
  name: doctor-test
  baseUrl: ${options.baseUrl ?? 'http://example.test'}
report:
  outputDirectory: ${options.reportPath ?? '.auto-e2e/reports'}
  artifactDirectory: .auto-e2e/artifacts
`);
  return root;
}

async function writeSpec(root: string, name: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(root, '.auto-e2e', 'specs', name), JSON.stringify(value));
}

async function fakeBetterWright(root: string, output: string, exitCode = 0): Promise<string> {
  const binary = path.join(root, 'fake-betterwright');
  await fs.writeFile(binary, `#!/bin/sh
printf '%s' '${output.replaceAll("'", "'\\''")}'
exit ${exitCode}
`);
  await fs.chmod(binary, 0o700);
  return binary;
}

function doctorJson(input: { ready: boolean; checks: unknown[] }): string {
  return JSON.stringify({
    ...input,
    browser: 'chromium-fork',
    browser_selection_reason: 'native-available',
    playwright_version: '1.61.1',
  });
}

const okFetch = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
