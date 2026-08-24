import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserClient, BrowserRunResult } from '../../src/browser/browser-client.js';
import { ExplorerAuthenticationAdapter } from '../../src/auth/explorer-auth.js';
import {
  PlaywrightAuthenticationAdapter,
  playwrightStorageStatePath,
} from '../../src/auth/playwright-auth.js';
import {
  AuthenticationManager,
  authenticationTargets,
} from '../../src/auth/authentication-manager.js';
import { defaultConfig } from '../../src/config/defaults.js';
import { AutoE2EError } from '../../src/runtime/exit-codes.js';

const authentication = {
  enabled: true as const,
  entryUrl: 'https://pt.example.com/protected',
  successUrlPrefix: 'https://pt.example.com/app/',
  successSelector: 'text=业务首页',
  interactiveTimeout: 1_000,
};

const browserConfig = {
  explorer: 'playwright' as const,
  browser: 'chromium' as const,
  channel: 'chrome' as const,
  headless: true,
  sessionProfile: 'pt-user',
  timeout: 1_000,
  implementation: 'real' as const,
};

function fakeExplorerClient(options: {
  probeUrl?: string;
  selectorFound?: boolean;
  handoff?: 'done' | 'cancel' | 'timeout';
} = {}): BrowserClient {
  return {
    async run<T>(code: string): Promise<BrowserRunResult<T>> {
      if (code.includes('selectorFound')) {
        return {
          ok: true,
          result: {
            url: options.probeUrl ?? 'https://pt.example.com/app/home',
            selectorFound: options.selectorFound ?? true,
          } as T,
        };
      }
      return { ok: true };
    },
    async startLiveView() {
      return { ok: true, url: 'http://127.0.0.1/capability-token' };
    },
    async waitForHandoff() {
      return { ok: true, action: options.handoff ?? 'done' };
    },
    async stopLiveView() {},
    async close() {},
  };
}

function explorerAdapter(
  client: BrowserClient,
  promptSink: (message: string) => void = () => undefined,
) {
  return new ExplorerAuthenticationAdapter({
    authentication,
    browser: browserConfig,
    profile: 'pt-user',
    promptSink,
    createClient: () => ({ client, close: async () => undefined }),
  });
}

describe('BetterWright explorer authentication', () => {
  it('通过本机 Live View handoff 后重新验证业务页面', async () => {
    const prompts: string[] = [];
    const result = await explorerAdapter(
      fakeExplorerClient(),
      (message) => prompts.push(message),
    ).prepare();
    expect(result).toEqual({ authenticated: true });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('127.0.0.1');
  });

  it.each(['cancel', 'timeout'] as const)('handoff %s 返回 AuthFailed', async (action) => {
    await expect(
      explorerAdapter(fakeExplorerClient({ handoff: action })).prepare(),
    ).rejects.toMatchObject({ exitCode: 5 });
  });

  it('重定向到认证页或缺少成功标记时判定未认证', async () => {
    await expect(
      explorerAdapter(
        fakeExplorerClient({ probeUrl: 'https://login.example.com/sso' }),
      ).check(),
    ).resolves.toMatchObject({ authenticated: false });
    await expect(
      explorerAdapter(fakeExplorerClient({ selectorFound: false })).check(),
    ).resolves.toMatchObject({ authenticated: false });
  });
});

interface FakePageOptions {
  url: string;
  selectorFound: boolean;
}

function fakePage(options: FakePageOptions) {
  return {
    async goto() {},
    url: () => options.url,
    locator: () => ({ count: async () => (options.selectorFound ? 1 : 0) }),
    isClosed: () => false,
  };
}

function fakeLauncher(options: {
  pages: FakePageOptions[];
  state?: unknown;
}) {
  return async () => {
    const pages = options.pages.map(fakePage);
    const context = {
      async newPage() {
        const page = pages[0] ?? fakePage({
          url: 'https://login.example.com',
          selectorFound: false,
        });
        if (pages.length === 0) pages.push(page);
        return page;
      },
      pages: () => pages,
      storageState: async () => options.state ?? { cookies: [], origins: [] },
      async close() {},
    };
    return {
      async newContext() {
        return context;
      },
      async close() {},
    };
  };
}

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function temporaryProjectRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-auth-test-'));
  temporaryRoots.push(root);
  return root;
}

describe('Playwright runner authentication', () => {
  it('识别弹窗中的业务页并以 0600 原子保存 storageState', async () => {
    const projectRoot = await temporaryProjectRoot();
    const secretState = {
      cookies: [{ name: 'session', value: 'sensitive-cookie' }],
      origins: [],
    };
    const adapter = new PlaywrightAuthenticationAdapter({
      projectRoot,
      authentication,
      profile: 'pt-user',
      checkTimeout: 1_000,
      launchBrowser: fakeLauncher({
        pages: [
          { url: 'https://login.example.com/sso', selectorFound: false },
          { url: 'https://pt.example.com/app/home', selectorFound: true },
        ],
        state: secretState,
      }),
      promptSink: () => undefined,
    });

    const result = await adapter.prepare();
    const statePath = playwrightStorageStatePath(projectRoot, 'pt-user');
    expect(result).toEqual({ authenticated: true, statePath });
    expect(JSON.parse(await fs.readFile(statePath, 'utf8'))).toEqual(secretState);
    expect((await fs.stat(statePath)).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(result)).not.toContain('sensitive-cookie');
  });

  it('认证超时不会覆盖已有状态文件', async () => {
    const projectRoot = await temporaryProjectRoot();
    const statePath = playwrightStorageStatePath(projectRoot, 'pt-user');
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, 'old-state', 'utf8');
    let clock = 0;
    const adapter = new PlaywrightAuthenticationAdapter({
      projectRoot,
      authentication: { ...authentication, interactiveTimeout: 100 },
      profile: 'pt-user',
      checkTimeout: 1_000,
      launchBrowser: fakeLauncher({
        pages: [{ url: 'https://login.example.com/sso', selectorFound: false }],
      }),
      now: () => clock,
      delay: async (milliseconds) => {
        clock += milliseconds;
      },
      promptSink: () => undefined,
    });

    await expect(adapter.prepare()).rejects.toMatchObject({ exitCode: 5 });
    expect(await fs.readFile(statePath, 'utf8')).toBe('old-state');
  });

  it('状态文件存在但在线校验失败时判定已失效', async () => {
    const projectRoot = await temporaryProjectRoot();
    const statePath = playwrightStorageStatePath(projectRoot, 'pt-user');
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, '{}', 'utf8');
    const adapter = new PlaywrightAuthenticationAdapter({
      projectRoot,
      authentication,
      profile: 'pt-user',
      checkTimeout: 1_000,
      launchBrowser: fakeLauncher({
        pages: [{ url: 'https://login.example.com/sso', selectorFound: false }],
      }),
      now: (() => {
        let clock = 0;
        return () => (clock += 1_000);
      })(),
      delay: async () => undefined,
    });
    await expect(adapter.check()).resolves.toMatchObject({
      authenticated: false,
      statePath,
    });
  });
});

describe('authentication orchestration', () => {
  it('默认关闭时预检不调用任何适配器', async () => {
    const prepare = vi.fn();
    const check = vi.fn();
    const manager = new AuthenticationManager({
      projectRoot: '/project',
      config: defaultConfig(),
      explorer: { prepare, check },
      runner: { prepare, check },
    });
    await expect(manager.assertReady(['explorer', 'runner'])).resolves.toEqual({});
    expect(check).not.toHaveBeenCalled();
  });

  it('按 target 调用对应适配器且失败提示精确修复命令', async () => {
    const explorer = {
      prepare: vi.fn(async () => ({ authenticated: true })),
      check: vi.fn(async () => ({ authenticated: true })),
    };
    const runner = {
      prepare: vi.fn(async () => ({ authenticated: true })),
      check: vi.fn(async () => ({
        authenticated: false,
        reason: 'expired',
        statePath: '/state.json',
      })),
    };
    const config = {
      ...defaultConfig(),
      authentication,
      browser: browserConfig,
    };
    const manager = new AuthenticationManager({
      projectRoot: '/project',
      config,
      explorer,
      runner,
    });

    await expect(manager.status(authenticationTargets('explorer'))).resolves.toEqual({
      explorer: { authenticated: true },
    });
    expect(runner.check).not.toHaveBeenCalled();

    await expect(manager.assertReady(['runner'])).rejects.toSatisfy((error) => {
      return (
        error instanceof AutoE2EError &&
        error.exitCode === 5 &&
        error.message.includes('--target runner')
      );
    });
  });
});
