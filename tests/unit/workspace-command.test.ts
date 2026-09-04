import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';
import { workspaceInitCommand } from '../../src/commands/workspace.js';

const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('workspace init command', () => {
  it('创建默认配置和 Spec 目录', async () => {
    const root = await temporaryRoot('my-web');
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(await workspaceInitCommand({ projectRoot: root })).toBe(0);
    expect((await fs.stat(path.join(root, '.auto-e2e/specs'))).isDirectory()).toBe(true);
    const config = YAML.parse(await fs.readFile(path.join(root, '.auto-e2e/config.yaml'), 'utf8'));
    expect(config).toEqual({
      project: { name: 'my-web', baseUrl: 'http://127.0.0.1:3000' },
      acceptance: {
        model: 'gpt-5.6-terra',
        profile: 'auto-e2e',
        headed: false,
        concurrency: 1,
        forbiddenActions: ['删除数据', '发布或部署', '发起付款或购买', '向外部人员发送消息'],
      },
    });
    expect(config.acceptance.databasePath).toBeUndefined();
    expect(config.report).toBeUndefined();
  });

  it('重复执行时保留现有配置并返回 unchanged', async () => {
    const root = await temporaryRoot('existing');
    const configFile = path.join(root, '.auto-e2e/config.yaml');
    await fs.mkdir(path.dirname(configFile));
    await fs.writeFile(configFile, 'custom: true\n');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(await workspaceInitCommand({ projectRoot: root, json: true })).toBe(0);
    expect(await fs.readFile(configFile, 'utf8')).toBe('custom: true\n');
    expect(JSON.parse(stdout.mock.calls.map(([chunk]) => String(chunk)).join(''))).toMatchObject({
      ok: true,
      config: { path: '.auto-e2e/config.yaml', action: 'unchanged' },
      specs: { path: '.auto-e2e/specs', action: 'created' },
    });
  });

  it('存在旧配置时阻止新配置覆盖其优先级', async () => {
    const root = await temporaryRoot('legacy');
    await fs.writeFile(path.join(root, '.auto-e2e.yaml'), 'project:\n  name: legacy\n');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(await workspaceInitCommand({ projectRoot: root, json: true })).toBe(2);
    expect(JSON.parse(stdout.mock.calls.map(([chunk]) => String(chunk)).join(''))).toMatchObject({
      ok: false,
      exitCode: 2,
      error: expect.stringContaining('检测到旧配置'),
    });
    await expect(fs.access(path.join(root, '.auto-e2e/config.yaml'))).rejects.toThrow();
    await expect(fs.access(path.join(root, '.auto-e2e/specs'))).rejects.toThrow();
  });
});

async function temporaryRoot(name: string): Promise<string> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-workspace-init-'));
  roots.push(parent);
  const root = path.join(parent, name);
  await fs.mkdir(root);
  return root;
}
