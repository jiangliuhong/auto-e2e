/**
 * 浏览器 Session/Profile 管理与工厂。
 *
 * - profile：独立身份（独立 cookie jar），如 admin。
 * - session：同一 profile 内的并行 lane。
 *
 * 根据配置选择 mock 或 real 原生 Playwright 实现。
 */
import type { BrowserClient, BrowserClientOptions } from './browser-client.js';
import { MockBrowserClient } from './mock-browser-client.js';
import { RealBrowserClient } from './real-browser-client.js';
import type { BrowserConfig } from '../config/config-schema.js';

export interface SessionManagerOptions {
  browser: BrowserConfig;
}

export class SessionManager {
  private clients = new Map<string, BrowserClient>();

  constructor(private readonly opts: SessionManagerOptions) {}

  /** 获取（或创建）指定 profile 的 client。 */
  getOrCreate(profile?: string): BrowserClient {
    const key = profile ?? this.opts.browser.sessionProfile;
    let client = this.clients.get(key);
    if (!client) {
      const clientOpts: BrowserClientOptions = {
        profile: key,
        headless: this.opts.browser.headless,
        channel: this.opts.browser.channel,
        timeout: this.opts.browser.timeout,
      };
      client =
        this.opts.browser.implementation === 'real'
          ? new RealBrowserClient(clientOpts)
          : new MockBrowserClient(clientOpts);
      this.clients.set(key, client);
    }
    return client;
  }

  /** 关闭所有已创建的 client。 */
  async closeAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.close().catch(() => undefined)));
    this.clients.clear();
  }
}
