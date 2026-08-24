import type { AuthenticationConfig, BrowserConfig } from '../config/config-schema.js';
import type { BrowserClient } from '../browser/browser-client.js';
import { SessionManager } from '../browser/session-manager.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import type { AuthenticationAdapter, AuthenticationCheck } from './auth-types.js';

interface ClientHandle {
  client: BrowserClient;
  close(): Promise<void>;
}

export interface ExplorerAuthenticationOptions {
  authentication: Extract<AuthenticationConfig, { enabled: true }>;
  browser: BrowserConfig;
  profile: string;
  promptSink?: (message: string) => void;
  createClient?: (headless: boolean) => ClientHandle;
}

interface ExplorerProbe {
  url: string;
  selectorFound: boolean;
}

/** 命名 Profile 的人工登录与在线预检。 */
export class ExplorerAuthenticationAdapter implements AuthenticationAdapter {
  private readonly promptSink: (message: string) => void;

  constructor(private readonly opts: ExplorerAuthenticationOptions) {
    this.promptSink =
      opts.promptSink ?? ((message) => process.stderr.write(`${message}\n`));
  }

  async prepare(): Promise<AuthenticationCheck> {
    const handle = this.createClient(false);
    try {
      const opened = await handle.client.run(
        `await page.goto(${JSON.stringify(this.opts.authentication.entryUrl)}, { waitUntil: 'domcontentloaded' })`,
        { session: this.opts.profile },
      );
      if (!opened.ok) {
        throw new AutoE2EError(
          ExitCode.BrowserFailed,
          `无法打开认证入口：${opened.error ?? '未知浏览器错误'}`,
        );
      }

      const liveView = await handle.client.startLiveView({
        expose: 'local',
        interactive: true,
        session: this.opts.profile,
      });
      if (!liveView.ok || !liveView.url) {
        throw new AutoE2EError(
          ExitCode.BrowserFailed,
          `无法启动人工认证接管窗口：${liveView.error ?? '未返回访问地址'}`,
        );
      }

      // 提示用户在打开的浏览器中完成认证
      this.promptSink(`请在打开的浏览器中完成业务认证，进入目标业务系统后继续：${liveView.url}`);
      const handoff = await handle.client.waitForHandoff({
        session: this.opts.profile,
        prompt: '请完成业务系统 SSO/MFA，确认进入目标业务页面。',
        timeout: Math.ceil(this.opts.authentication.interactiveTimeout / 1000),
      });
      if (!handoff.ok || handoff.action !== 'done') {
        throw new AutoE2EError(
          ExitCode.AuthFailed,
          handoff.action === 'timeout'
            ? '等待人工认证超时'
            : handoff.action === 'cancel'
              ? '用户取消了人工认证'
              : `人工认证未完成：${handoff.error ?? '未知原因'}`,
        );
      }

      const checked = await this.probe(handle.client);
      if (!checked.authenticated) {
        throw new AutoE2EError(
          ExitCode.AuthFailed,
          `认证校验失败：${checked.reason ?? '未进入目标业务页面'}`,
        );
      }
      return checked;
    } finally {
      await handle.client.stopLiveView().catch(() => undefined);
      await handle.close().catch(() => undefined);
    }
  }

  async check(): Promise<AuthenticationCheck> {
    const handle = this.createClient(this.opts.browser.headless);
    try {
      return await this.probe(handle.client);
    } catch (error) {
      return {
        authenticated: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await handle.close().catch(() => undefined);
    }
  }

  private async probe(client: BrowserClient): Promise<AuthenticationCheck> {
    const result = await client.run<ExplorerProbe>(
      [
        `await page.goto(${JSON.stringify(this.opts.authentication.entryUrl)}, { waitUntil: 'domcontentloaded' });`,
        'let selectorFound = false;',
        `try { await page.locator(${JSON.stringify(this.opts.authentication.successSelector)}).first().waitFor({ state: 'attached', timeout: ${this.opts.browser.timeout} }); selectorFound = true; } catch {}`,
        'return { url: page.url(), selectorFound };',
      ].join('\n'),
      { session: this.opts.profile },
    );
    if (!result.ok || !result.result) {
      return {
        authenticated: false,
        reason: result.error ?? '未返回认证校验结果',
      };
    }
    if (!result.result.url.startsWith(this.opts.authentication.successUrlPrefix)) {
      return {
        authenticated: false,
        reason: `当前页面未进入配置的业务 URL 前缀（${redactedUrl(result.result.url)}）`,
      };
    }
    if (!result.result.selectorFound) {
      return {
        authenticated: false,
        reason: '业务页面认证成功标记不存在',
      };
    }
    return { authenticated: true };
  }

  private createClient(headless: boolean): ClientHandle {
    if (this.opts.createClient) return this.opts.createClient(headless);
    const manager = new SessionManager({
      browser: { ...this.opts.browser, headless },
    });
    return {
      client: manager.getOrCreate(this.opts.profile),
      close: () => manager.closeAll(),
    };
  }
}

function redactedUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '无法识别的重定向地址';
  }
}
