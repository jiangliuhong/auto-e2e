import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCommand } from '../../src/commands/init.js';

const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('init command', () => {
  it('使用随包 BetterWright 初始化浏览器并在缺少模型时登录 Codex', async () => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(await initCommand({ projectRoot: root, betterwrightBinary: binary })).toBe(0);
    const calls = await fs.readFile(path.join(root, 'calls.log'), 'utf8');
    expect(calls.trim().split('\n')).toEqual([
      'init --yes --skip-agents',
      'doctor --json',
      'auth --login codex',
      'doctor --json',
      'doctor --json',
    ]);
  });

  it('已有模型后端时不重复登录，并在 JSON 模式返回初始化结果', async () => {
    const root = await temporaryRoot();
    await fs.writeFile(path.join(root, 'signed-in'), 'yes');
    const binary = await fakeBetterWright(root);
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(await initCommand({ projectRoot: root, betterwrightBinary: binary, json: true })).toBe(0);
    const payload = JSON.parse(stdout.mock.calls.map(([chunk]) => String(chunk)).join('')) as Record<string, unknown>;
    expect(payload).toEqual({
      ok: true,
      initialized: true,
      browser: 'chromium-fork',
      modelBackend: 'codex (signed in)',
    });
    const calls = await fs.readFile(path.join(root, 'calls.log'), 'utf8');
    expect(calls).not.toContain('auth --login');
  });

  it('--skip-auth 在没有模型后端时保留明确阻塞结果', async () => {
    const root = await temporaryRoot();
    const binary = await fakeBetterWright(root);
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(await initCommand({
      projectRoot: root,
      betterwrightBinary: binary,
      skipAuth: true,
      json: true,
    })).toBe(2);
    const payload = JSON.parse(stdout.mock.calls.map(([chunk]) => String(chunk)).join('')) as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      exitCode: 2,
      error: expect.stringContaining('模型后端尚未就绪'),
    }));
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-init-'));
  roots.push(root);
  return root;
}

async function fakeBetterWright(root: string): Promise<string> {
  const binary = path.join(root, 'fake-betterwright');
  await fs.writeFile(binary, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = ${JSON.stringify(root)};
const args = process.argv.slice(2);
fs.appendFileSync(path.join(root, 'calls.log'), args.join(' ') + '\\n');
if (args[0] === 'init') {
  process.stdout.write('browser ready\\n');
  process.exit(0);
}
if (args[0] === 'auth') {
  fs.writeFileSync(path.join(root, 'signed-in'), 'yes');
  process.stdout.write('signed in\\n');
  process.exit(0);
}
if (args[0] === 'doctor') {
  const signedIn = fs.existsSync(path.join(root, 'signed-in'));
  process.stdout.write(JSON.stringify({
    ready: true,
    browser: 'chromium-fork',
    browser_selection_reason: 'native-available',
    playwright_version: '1.61.1',
    checks: [{
      group: 'Built-in agent',
      label: 'Model backends',
      status: signedIn ? 'ok' : 'warn',
      detail: signedIn ? 'codex (signed in)' : 'none configured'
    }]
  }));
  process.exit(0);
}
process.exit(1);
`, 'utf8');
  await fs.chmod(binary, 0o700);
  return binary;
}
