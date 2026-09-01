import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/config/config-loader.js';

describe('acceptance config', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('缺少配置时使用项目目录名与安全默认值', async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-config-'));
    const root = path.join(parent, 'my-web');
    await fs.mkdir(root);
    const config = await loadConfig({ projectRoot: root });
    expect(config.project.name).toBe('my-web');
    expect(config.acceptance.databasePath).toBe('.auto-e2e/history.sqlite');
    expect(config.acceptance.concurrency).toBe(1);
    expect(config.acceptance.forbiddenActions).toContain('删除数据');
  });

  it('读取 .auto-e2e.yaml 并应用环境覆盖', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-config-'));
    await fs.writeFile(path.join(root, '.auto-e2e.yaml'), `project:
  name: configured
  baseUrl: https://test.example.com
acceptance:
  model: test-model
  concurrency: 3
`, 'utf8');
    vi.stubEnv('AUTO_E2E_MODEL', 'override-model');
    const config = await loadConfig({ projectRoot: root });
    expect(config.project.baseUrl).toBe('https://test.example.com');
    expect(config.acceptance.model).toBe('override-model');
    expect(config.acceptance.concurrency).toBe(3);
  });

  it('拒绝超出范围的并发数', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-config-'));
    await fs.writeFile(path.join(root, '.auto-e2e.yaml'), `project:
  name: configured
  baseUrl: https://test.example.com
acceptance:
  concurrency: 0
`, 'utf8');
    await expect(loadConfig({ projectRoot: root })).rejects.toThrow('acceptance.concurrency');
  });
});
