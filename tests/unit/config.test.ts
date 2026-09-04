import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workspaceId } from '../../src/config/paths.js';
import { loadConfig, resolveConfigFile } from '../../src/config/config-loader.js';

describe('acceptance config', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('缺少配置时使用项目目录名与安全默认值', async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-config-'));
    const root = path.join(parent, 'my-web');
    await fs.mkdir(root);
    const config = await loadConfig({ projectRoot: root });
    expect(config.project.name).toBe('my-web');
    expect(config.acceptance.model).toBe('gpt-5.6-terra');
    expect(config.acceptance.databasePath).toBe(path.join(process.env.AUTO_E2E_HOME!, 'projects', workspaceId(root), 'history.sqlite'));
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


describe('configuration and storage layout', () => {
  const roots: string[] = [];
  async function project() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-layout-'));
    roots.push(root);
    await fs.mkdir(path.join(root, '.auto-e2e'));
    return root;
  }
  async function configFile(root: string, name: string, extra = '') {
    await fs.writeFile(path.join(root, name), `project:\n  name: ${name.replaceAll('/', '-')}\n  baseUrl: http://localhost:3000\n${extra}`);
  }
  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });


  it('CLI --config 选择独立数据库且 JSON stdout 只有最终结果', async () => {
    const root = await project();
    await configFile(root, '.auto-e2e/config.yaml');
    await configFile(root, 'custom.yaml', 'acceptance:\n  databasePath: selected/history.sqlite\n');
    const cli = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
    const output = execFileSync(process.execPath, ['--import', 'tsx', cli,
      '--project-root', root, '--config', 'custom.yaml', '--json', 'list'], { encoding: 'utf8' });
    expect(JSON.parse(output)).toEqual({ ok: true, runs: [] });
    await expect(fs.access(path.join(root, 'selected/history.sqlite'))).resolves.toBeUndefined();
    const defaults = await loadConfig({ projectRoot: root });
    await expect(fs.access(defaults.acceptance.databasePath)).rejects.toThrow();
  });

  it('环境变量仍能补齐配置中的项目值', async () => {
    const root = await project();
    await fs.writeFile(path.join(root, '.auto-e2e/config.yaml'), 'project: {}');
    vi.stubEnv('AUTO_E2E_PROJECT_NAME', 'from-env');
    vi.stubEnv('AUTO_E2E_TARGET_URL', 'http://localhost:4000');
    const config = await loadConfig({ projectRoot: root });
    expect(config.project).toEqual({ name: 'from-env', baseUrl: 'http://localhost:4000' });
  });

  it('显式配置优先于新文件，新文件优先于旧文件，且不合并', async () => {
    const root = await project();
    await configFile(root, '.auto-e2e.yaml', 'acceptance:\n  model: legacy-model\n');
    await configFile(root, '.auto-e2e/config.yaml');
    await configFile(root, 'custom.yaml');
    expect((await loadConfig({ projectRoot: root })).project.name).toBe('.auto-e2e-config.yaml');
    expect((await loadConfig({ projectRoot: root })).acceptance.model).not.toBe('legacy-model');
    expect((await loadConfig({ projectRoot: root, configPath: 'custom.yaml' })).project.name).toBe('custom.yaml');
    await expect(loadConfig({ projectRoot: root, configPath: 'missing.yaml' })).rejects.toThrow('无法读取配置文件');
    await fs.writeFile(path.join(root, '.auto-e2e/config.yaml'), 'project: [invalid');
    await expect(loadConfig({ projectRoot: root })).rejects.toThrow('无法读取配置文件');
    await fs.rm(path.join(root, '.auto-e2e/config.yaml'));
    expect(await resolveConfigFile({ projectRoot: root })).toBe(path.join(root, '.auto-e2e.yaml'));
  });

  it('相对存储路径以项目根目录为基准，显式路径覆盖 AUTO_E2E_HOME', async () => {
    const root = await project();
    await configFile(root, '.auto-e2e/config.yaml', 'acceptance:\n  databasePath: custom/history.sqlite\nreport:\n  outputDirectory: custom/reports\n  artifactDirectory: ~/auto-e2e-proof\n');
    const config = await loadConfig({ projectRoot: root });
    expect(config.acceptance.databasePath).toBe(path.join(root, 'custom/history.sqlite'));
    expect(config.report.outputDirectory).toBe(path.join(root, 'custom/reports'));
    expect(config.report.artifactDirectory).toBe(path.join(os.homedir(), 'auto-e2e-proof'));
  });

  it.each(['history.sqlite', 'history.sqlite-wal', 'artifacts', 'reports'])('存在旧 %s 时整套路径保持在项目内', async (marker) => {
    vi.stubEnv('AUTO_E2E_HOME', '');
    const root = await project();
    if (marker.includes('sqlite')) await fs.writeFile(path.join(root, '.auto-e2e', marker), '');
    else await fs.mkdir(path.join(root, '.auto-e2e', marker));
    const config = await loadConfig({ projectRoot: root });
    expect(config.acceptance.databasePath).toBe(path.join(root, '.auto-e2e/history.sqlite'));
    expect(config.report.outputDirectory).toBe(path.join(root, '.auto-e2e/reports'));
    expect(config.report.artifactDirectory).toBe(path.join(root, '.auto-e2e/artifacts'));
  });

  it('仅有配置和 Spec 时使用用户目录；读取配置不创建运行目录', async () => {
    vi.stubEnv('AUTO_E2E_HOME', '');
    const root = await project();
    await configFile(root, '.auto-e2e/config.yaml');
    await fs.mkdir(path.join(root, '.auto-e2e/specs'));
    const config = await loadConfig({ projectRoot: root });
    expect(config.acceptance.databasePath).toBe(path.join(os.homedir(), '.auto-e2e/projects', workspaceId(root), 'history.sqlite'));
    await expect(fs.access(path.dirname(config.acceptance.databasePath))).rejects.toThrow();
  });

  it('AUTO_E2E_HOME 显式覆盖旧默认位置，但不移动旧数据', async () => {
    const root = await project();
    const legacy = path.join(root, '.auto-e2e/history.sqlite');
    await fs.writeFile(legacy, 'legacy');
    const config = await loadConfig({ projectRoot: root });
    expect(config.acceptance.databasePath).toBe(path.join(process.env.AUTO_E2E_HOME!, 'projects', workspaceId(root), 'history.sqlite'));
    expect(await fs.readFile(legacy, 'utf8')).toBe('legacy');
  });

  it('同名项目隔离，符号链接共享真实工作区 ID', async () => {
    const root = await project();
    const other = await project();
    const first = path.join(root, 'demo');
    const second = path.join(other, 'demo');
    await fs.mkdir(first);
    await fs.mkdir(second);
    const alias = path.join(root, 'alias');
    await fs.symlink(first, alias);
    const a = await loadConfig({ projectRoot: first });
    const b = await loadConfig({ projectRoot: second });
    const c = await loadConfig({ projectRoot: alias });
    expect(a.acceptance.databasePath).not.toBe(b.acceptance.databasePath);
    expect(a.acceptance.databasePath).toBe(c.acceptance.databasePath);
  });
});
