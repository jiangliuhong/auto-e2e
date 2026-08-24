/**
 * RealBrowserClient：基于原生 Playwright 的浏览器客户端实现。
 *
 * 支持直接使用本机 Google Chrome（通过 channel: 'chrome'），
 * 负责页面导航、DOM 探测、快照生成、截图与会话管理。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, Page, Locator } from '@playwright/test';
import type {
  BrowserClient,
  BrowserClientOptions,
  BrowserRunResult,
  BrowserRunOptions,
  BrowserLiveViewResult,
  BrowserHandoffResult,
} from './browser-client.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';

export class RealBrowserClient implements BrowserClient {
  private browser?: Browser;
  private defaultContext?: BrowserContext;
  private contexts = new Map<string, BrowserContext>();
  private pages = new Map<string, Page>();
  private readonly opts: BrowserClientOptions;
  private liveViewUrl?: string;

  constructor(opts: BrowserClientOptions = {}) {
    this.opts = opts;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    const { chromium } = await import('@playwright/test');
    const channel = this.opts.channel ?? 'chrome';
    const headless = this.opts.headless ?? true;

    try {
      if (channel === 'chrome') {
        try {
          this.browser = await chromium.launch({
            headless,
            channel: 'chrome',
          });
          return this.browser;
        } catch {
          // 若本机未安装默认路径的 Google Chrome，回退至 Playwright 内置 chromium
          this.browser = await chromium.launch({ headless });
          return this.browser;
        }
      } else if (channel === 'msedge') {
        try {
          this.browser = await chromium.launch({
            headless,
            channel: 'msedge',
          });
          return this.browser;
        } catch {
          this.browser = await chromium.launch({ headless });
          return this.browser;
        }
      } else {
        this.browser = await chromium.launch({ headless });
        return this.browser;
      }
    } catch (err) {
      throw new AutoE2EError(
        ExitCode.BrowserFailed,
        `无法启动 Playwright 浏览器：${err instanceof Error ? err.message : String(err)}。`,
        err,
      );
    }
  }

  private async getPage(session?: string): Promise<Page> {
    const key = session ?? this.opts.profile ?? 'default';
    let page = this.pages.get(key);
    if (page && !page.isClosed()) {
      return page;
    }

    const browser = await this.getBrowser();
    let context = this.contexts.get(key);
    if (!context) {
      context = await browser.newContext();
      this.contexts.set(key, context);
    }

    const existingPages = context.pages().filter((p) => !p.isClosed());
    if (existingPages.length > 0) {
      page = existingPages[0]!;
    } else {
      page = await context.newPage();
    }
    this.pages.set(key, page);
    return page;
  }

  async run<T = unknown>(code: string, options?: BrowserRunOptions): Promise<BrowserRunResult<T>> {
    try {
      const page = await this.getPage(options?.session);
      const context = page.context();

      // 提供辅助函数与执行环境
      const human = {
        click: async (locator: Locator) => {
          await locator.click();
        },
      };

      const snapshot = async (opts?: { interactive?: boolean }) => {
        return generateInteractiveSnapshot(page);
      };

      const screenshot = async (shotOpts?: { kind?: string }) => {
        const artifactsDir =
          this.opts.artifactsDir ?? path.join(process.cwd(), '.auto-e2e', 'artifacts', 'proofs');
        await fs.mkdir(artifactsDir, { recursive: true });
        const proofPath = path.join(
          artifactsDir,
          `proof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`,
        );
        await page.screenshot({ path: proofPath });
        return {
          path: proofPath,
          kind: shotOpts?.kind ?? 'proof',
          proofPath,
        };
      };

      // 构造并运行异步执行函数
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(
        'page',
        'context',
        'human',
        'snapshot',
        'screenshot',
        code.includes('return') || code.includes(';') ? code : `return ${code}`,
      );

      const result = await fn(page, context, human, snapshot, screenshot);

      if (result && typeof result === 'object' && 'proofPath' in result) {
        return {
          ok: true,
          result: result as T,
          proofPath: (result as { proofPath?: string }).proofPath,
        };
      }

      return {
        ok: true,
        result: result as T,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async startLiveView(_options?: {
    expose?: 'local';
    interactive?: boolean;
    session?: string;
  }): Promise<BrowserLiveViewResult> {
    try {
      const page = await this.getPage(_options?.session);
      this.liveViewUrl = page.url() || 'about:blank';
      return { ok: true, url: this.liveViewUrl };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async waitForHandoff(options?: {
    session?: string;
    prompt?: string;
    timeout?: number;
  }): Promise<BrowserHandoffResult> {
    try {
      const page = await this.getPage(options?.session);
      const timeoutMs = (options?.timeout ?? 30) * 1000;
      // 等待页面进入就绪或导航完成
      await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => undefined);
      return { ok: true, action: 'done' };
    } catch (err) {
      return {
        ok: false,
        action: 'timeout',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async stopLiveView(): Promise<void> {
    this.liveViewUrl = undefined;
  }

  async close(): Promise<void> {
    try {
      for (const page of this.pages.values()) {
        if (!page.isClosed()) await page.close().catch(() => undefined);
      }
      this.pages.clear();

      for (const context of this.contexts.values()) {
        await context.close().catch(() => undefined);
      }
      this.contexts.clear();

      if (this.defaultContext) {
        await this.defaultContext.close().catch(() => undefined);
        this.defaultContext = undefined;
      }

      if (this.browser) {
        await this.browser.close().catch(() => undefined);
        this.browser = undefined;
      }
    } catch {
      // 忽略关闭异常
    }
  }
}

/**
 * 通过 DOM 遍历提取页面可交互元素，格式化为与 explorer 兼容的快照文本。
 * 格式示例：`- button "登录" [ref=e1]`
 */
async function generateInteractiveSnapshot(page: Page): Promise<string> {
  return page.evaluate(() => {
    const interactiveSelectors = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="combobox"]',
      '[role="textbox"]',
      '[data-testid]',
      '[aria-label]',
    ];

    const matched = Array.from(
      document.querySelectorAll(interactiveSelectors.join(', ')),
    );

    const title = document.title || 'page';
    const lines: string[] = [`page page-1 ${window.location.href}`];
    let refIndex = 1;

    for (const el of matched) {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      const style = window.getComputedStyle(htmlEl);

      // 过滤不可见元素
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        rect.width === 0 ||
        rect.height === 0
      ) {
        continue;
      }

      const role =
        htmlEl.getAttribute('role') || htmlEl.tagName.toLowerCase();
      const name =
        htmlEl.getAttribute('aria-label') ||
        htmlEl.getAttribute('placeholder') ||
        htmlEl.getAttribute('data-testid') ||
        (htmlEl as HTMLInputElement).value ||
        htmlEl.innerText?.trim() ||
        '';

      const cleanName = name.replace(/[\r\n]+/g, ' ').slice(0, 80).trim();
      const ref = `e${refIndex++}`;
      lines.push(`- ${role} "${cleanName}" [ref=${ref}]`);
    }

    return lines.join('\n');
  });
}

/** 兼容旧命名导出。 */
export { RealBrowserClient as RealBetterWrightClient };
