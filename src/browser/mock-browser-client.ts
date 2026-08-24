/**
 * MockBrowserClient：不打开真实浏览器，基于代码字符串模拟页面交互。
 *
 * 维护一个简单的内存页面状态（当前 URL、title、已知元素），供 explorer 在离线
 * 闭环中测试。识别常见 Playwright 调用：
 * - page.goto(url)
 * - return page.title()
 * - return page.url()
 * - screenshot({kind:'proof'}) -> 返回虚拟 proof 路径
 */
import type {
  BrowserClient,
  BrowserClientOptions,
  BrowserRunResult,
  BrowserRunOptions,
} from './browser-client.js';

export class MockBrowserClient implements BrowserClient {
  private url = '';
  private title = '';
  private readonly profile?: string;
  private readonly headless: boolean;
  /** mock 模式下「页面」已知的元素清单（用于探索结果填充）。 */
  readonly knownElements: Array<{
    description: string;
    locator: string;
    testid?: string;
  }> = [];

  constructor(opts: BrowserClientOptions = {}) {
    this.profile = opts.profile;
    this.headless = opts.headless ?? true;
  }

  async run<T = unknown>(code: string, _options?: BrowserRunOptions): Promise<BrowserRunResult<T>> {
    if (code.includes('selectorFound')) {
      return {
        ok: true,
        result: { url: this.url, selectorFound: true } as T,
      };
    }
    // page.goto('url')
    const gotoMatch = code.match(/page\.goto\(['"]([^'"]+)['"]/);
    if (gotoMatch) {
      this.url = gotoMatch[1]!;
      this.title = this.deriveTitle(this.url);
      return { ok: true };
    }
    // return page.title()
    if (/return\s+page\.title\(\)/.test(code)) {
      return { ok: true, result: this.title as T };
    }
    // return page.url()
    if (/return\s+page\.url\(\)/.test(code)) {
      return { ok: true, result: this.url as T };
    }
    // screenshot({kind:'proof'}) -> 虚拟路径
    if (/screenshot\(/.test(code)) {
      const proofPath = `.auto-e2e/artifacts/mock/proof-${Date.now()}.png`;
      return { ok: true, result: proofPath as T, proofPath };
    }
    if (/snapshot\(/.test(code)) {
      return { ok: true, result: MOCK_INTERACTIVE_SNAPSHOT as unknown as T };
    }
    if (code.includes('const locator = page.getBy')) {
      return {
        ok: true,
        result: { count: 1, visible: true, enabled: true } as T,
      };
    }
    // 默认成功。
    return { ok: true };
  }

  async startLiveView(): Promise<{ ok: boolean; url?: string }> {
    return { ok: true, url: 'http://127.0.0.1/mock-live-view' };
  }

  async waitForHandoff(): Promise<{ ok: boolean; action?: 'done' }> {
    return { ok: true, action: 'done' };
  }

  async stopLiveView(): Promise<void> {
    // 无资源需要释放。
  }

  async close(): Promise<void> {
    // 无资源需要释放。
  }

  private deriveTitle(url: string): string {
    try {
      const u = new URL(url);
      const seg = u.pathname.split('/').filter(Boolean)[0] ?? 'home';
      return seg;
    } catch {
      return url;
    }
  }

  /** 测试辅助：注册已知元素。 */
  registerKnownElements(elements: MockBrowserClient['knownElements']): void {
    this.knownElements.push(...elements);
  }
}

/** 兼容旧命名导出。 */
export { MockBrowserClient as MockBetterWrightClient };

/**
 * mock 模式下「页面」返回的关键元素清单。
 * 对齐示例 task-spec（用户禁用功能）与 explorer 的 ProbeElement 结构，
 * 让生成的测试能拿到稳定的 testid 定位器并写出 expect 断言。
 */
const MOCK_INTERACTIVE_SNAPSHOT = [
  'page page-1 http://localhost/',
  '- status "正常" [ref=e1]',
  '- button "禁用" [ref=e2]',
  '- button "确认" [ref=e3]',
  '- button "取消" [ref=e4]',
].join('\n');
