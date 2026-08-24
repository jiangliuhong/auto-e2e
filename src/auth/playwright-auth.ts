import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuthenticationConfig } from '../config/config-schema.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import type { AuthenticationAdapter, AuthenticationCheck } from './auth-types.js';

interface AuthLocator {
  count(): Promise<number>;
}

interface AuthPage {
  goto(url: string, options?: { waitUntil?: 'domcontentloaded'; timeout?: number }): Promise<unknown>;
  url(): string;
  locator(selector: string): AuthLocator;
  isClosed(): boolean;
}

interface AuthContext {
  newPage(): Promise<AuthPage>;
  pages(): AuthPage[];
  storageState(): Promise<unknown>;
  close(): Promise<void>;
}

interface AuthBrowser {
  newContext(options?: { storageState?: string }): Promise<AuthContext>;
  close(): Promise<void>;
}

type BrowserLauncher = (options: { headless: boolean }) => Promise<AuthBrowser>;

export interface PlaywrightAuthenticationOptions {
  projectRoot: string;
  authentication: Extract<AuthenticationConfig, { enabled: true }>;
  profile: string;
  checkTimeout: number;
  launchBrowser?: BrowserLauncher;
  now?: () => number;
  delay?: (milliseconds: number) => Promise<void>;
  promptSink?: (message: string) => void;
}

/** 返回 Playwright 独立认证状态的固定、安全路径。 */
export function playwrightStorageStatePath(projectRoot: string, profile: string): string {
  assertSafeProfile(profile);
  return path.join(
    projectRoot,
    '.auto-e2e',
    'auth',
    profile,
    'playwright-storage-state.json',
  );
}

export function assertSafeProfile(profile: string): void {
  if (!/^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]*$/.test(profile)) {
    throw new AutoE2EError(
      ExitCode.ConfigError,
      `无效的浏览器 Profile 名称：${profile}`,
    );
  }
}

/** Playwright headed 登录、storageState 安全落盘与在线预检。 */
export class PlaywrightAuthenticationAdapter implements AuthenticationAdapter {
  private readonly now: () => number;
  private readonly delay: (milliseconds: number) => Promise<void>;

  constructor(private readonly opts: PlaywrightAuthenticationOptions) {
    this.now = opts.now ?? Date.now;
    this.delay =
      opts.delay ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async prepare(): Promise<AuthenticationCheck> {
    const promptSink =
      this.opts.promptSink ?? ((message: string) => process.stderr.write(`${message}\n`));
    promptSink(
      `请在即将打开的 Playwright 浏览器中完成业务认证；进入 ${this.opts.authentication.successUrlPrefix} 后会自动保存状态。`,
    );
    const browser = await this.launch({ headless: false });
    let context: AuthContext | undefined;
    let temporaryPath: string | undefined;
    try {
      context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(this.opts.authentication.entryUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.opts.checkTimeout,
      });

      const authenticated = await this.waitForAuthenticatedContext(
        context,
        this.opts.authentication.interactiveTimeout,
      );
      if (!authenticated) {
        throw new AutoE2EError(
          ExitCode.AuthFailed,
          '等待 Playwright 人工认证超时或浏览器已关闭',
        );
      }

      const state = await context.storageState();
      const statePath = playwrightStorageStatePath(this.opts.projectRoot, this.opts.profile);
      const stateDir = path.dirname(statePath);
      await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
      await fs.chmod(stateDir, 0o700);
      temporaryPath = path.join(
        stateDir,
        `.playwright-storage-state.${process.pid}.${this.now()}.tmp`,
      );
      await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      await fs.chmod(temporaryPath, 0o600);
      await fs.rename(temporaryPath, statePath);
      temporaryPath = undefined;
      await fs.chmod(statePath, 0o600);
      return { authenticated: true, statePath };
    } catch (error) {
      if (error instanceof AutoE2EError) throw error;
      throw new AutoE2EError(
        ExitCode.AuthFailed,
        `Playwright 人工认证失败：${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    } finally {
      if (temporaryPath) await fs.unlink(temporaryPath).catch(() => undefined);
      await context?.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }

  async check(): Promise<AuthenticationCheck> {
    const statePath = playwrightStorageStatePath(this.opts.projectRoot, this.opts.profile);
    try {
      await fs.access(statePath);
    } catch {
      return { authenticated: false, statePath, reason: 'Playwright 认证状态文件不存在' };
    }

    let browser: AuthBrowser | undefined;
    let context: AuthContext | undefined;
    try {
      browser = await this.launch({ headless: true });
      context = await browser.newContext({ storageState: statePath });
      const page = await context.newPage();
      await page.goto(this.opts.authentication.entryUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.opts.checkTimeout,
      });
      const authenticated = await this.waitForAuthenticatedContext(
        context,
        this.opts.checkTimeout,
      );
      return authenticated
        ? { authenticated: true, statePath }
        : {
            authenticated: false,
            statePath,
            reason: 'Playwright 状态已失效或未进入目标业务页面',
          };
    } catch (error) {
      return {
        authenticated: false,
        statePath,
        reason: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
  }

  private async waitForAuthenticatedContext(
    context: AuthContext,
    timeoutMs: number,
  ): Promise<boolean> {
    const deadline = this.now() + timeoutMs;
    while (this.now() <= deadline) {
      if (await this.contextIsAuthenticated(context)) return true;
      if (context.pages().length === 0) return false;
      await this.delay(500);
    }
    return false;
  }

  private async contextIsAuthenticated(context: AuthContext): Promise<boolean> {
    for (const page of context.pages()) {
      if (page.isClosed()) continue;
      if (!page.url().startsWith(this.opts.authentication.successUrlPrefix)) continue;
      try {
        if ((await page.locator(this.opts.authentication.successSelector).count()) > 0) {
          return true;
        }
      } catch {
        // 页面可能在轮询期间导航，继续检查其他页面或下一轮。
      }
    }
    return false;
  }

  private async launch(options: { headless: boolean }): Promise<AuthBrowser> {
    if (this.opts.launchBrowser) return this.opts.launchBrowser(options);
    const { chromium } = await import('@playwright/test');
    return chromium.launch(options) as unknown as AuthBrowser;
  }
}
