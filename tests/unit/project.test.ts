import { describe, it, expect } from 'vitest';
import { inspectProject } from '../../src/project/project-inspector.js';
import { waitForHealthy, probeHealth } from '../../src/project/health-checker.js';
import { ensureAppRunning } from '../../src/project/process-manager.js';
import { AutoE2EError } from '../../src/runtime/exit-codes.js';

describe('project-inspector', () => {
  it('识别 Node 项目与 Playwright', async () => {
    const files = new Map<string, string>([
      [
        '/proj/package.json',
        JSON.stringify({
          name: 'demo',
          scripts: { dev: 'next dev' },
          devDependencies: { '@playwright/test': '^1.0' },
        }),
      ],
    ]);
    const exists = new Set(['/proj/playwright.config.ts']);
    const r = await inspectProject({
      projectRoot: '/proj',
      readFile: async (f) => files.get(f) ?? (() => { throw new Error('ENOENT'); })(),
      fileExists: async (f) => exists.has(f),
    });
    expect(r.isNodeProject).toBe(true);
    expect(r.packageName).toBe('demo');
    expect(r.playwrightInstalled).toBe(true);
    expect(r.hasPlaywrightConfig).toBe(true);
    expect(r.playwrightConfigFile).toBe('playwright.config.ts');
  });

  it('无 package.json 时不是 Node 项目', async () => {
    const r = await inspectProject({
      projectRoot: '/empty',
      readFile: async () => { throw new Error('ENOENT'); },
      fileExists: async () => false,
    });
    expect(r.isNodeProject).toBe(false);
    expect(r.playwrightInstalled).toBe(false);
  });
});

describe('health-checker', () => {
  it('waitForHealthy 首次成功立即返回', async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls++;
      return { ok: true, status: 200 };
    };
    const r = await waitForHealthy({
      healthUrl: 'http://x',
      timeoutMs: 5000,
      fetchFn,
      now: (() => 0) as never,
      sleep: async () => undefined,
    });
    // now 固定 0，waitedMs 为 0。
    void r;
    expect(calls).toBe(1);
  });

  it('waitForHealthy 超时返回 unhealthy', async () => {
    let time = 0;
    const r = await waitForHealthy({
      healthUrl: 'http://x',
      timeoutMs: 3000,
      fetchFn: async () => ({ ok: false, status: 500 }),
      now: () => {
        time += 2000;
        return time;
      },
      sleep: async () => undefined,
    });
    expect(r.healthy).toBe(false);
  });

  it('probeHealth 捕获异常返回 false', async () => {
    const fetchFn = async () => {
      throw new Error('ECONNREFUSED');
    };
    expect(await probeHealth('http://x', fetchFn)).toBe(false);
  });
});

describe('process-manager', () => {
  it('应用已健康时不启动进程', async () => {
    let spawned = false;
    const app = await ensureAppRunning({
      projectRoot: '/proj',
      startCommand: 'npm run dev',
      healthUrl: 'http://x',
      startupTimeout: 1000,
      fetchFn: async () => ({ ok: true, status: 200 }),
      spawnImpl: (() => {
        spawned = true;
        return {} as never;
      }) as never,
    });
    expect(app.startedByUs).toBe(false);
    expect(spawned).toBe(false);
  });

  it('启动后超时仍不可达抛 AutoE2EError(2) 并停止进程', async () => {
    const killedRef = { killed: false };
    const fakeChild = {
      killed: false,
      kill: () => {
        killedRef.killed = true;
      },
    };
    await expect(
      ensureAppRunning({
        projectRoot: '/proj',
        startCommand: 'npm run dev',
        healthUrl: 'http://x',
        startupTimeout: 300,
        fetchFn: async () => ({ ok: false, status: 0 }),
        spawnImpl: (() => fakeChild) as never,
      }),
    ).rejects.toMatchObject({ exitCode: 2 });
    // 启动失败时进程应被关闭。
    expect(killedRef.killed).toBe(true);
  });
});
