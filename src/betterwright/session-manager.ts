/**
 * 浏览器 Session/Profile 管理与工厂（plan §3.2, §6.2）。
 *
 * - profile：独立身份（独立 cookie jar），如 admin。
 * - session：同一 profile 内的并行 lane。
 *
 * 根据配置选择 mock 或 real 实现。
 */
import type { BetterWrightClient, BetterWrightClientOptions } from './betterwright-client.js';
import { MockBetterWrightClient } from './mock-betterwright-client.js';
import { RealBetterWrightClient } from './real-betterwright-client.js';
import type { BrowserConfig } from '../config/config-schema.js';

export interface SessionManagerOptions {
  browser: BrowserConfig;
}

export class SessionManager {
  private clients = new Map<string, BetterWrightClient>();

  constructor(private readonly opts: SessionManagerOptions) {}

  /** 获取（或创建）指定 profile 的 client。 */
  getOrCreate(profile?: string): BetterWrightClient {
    const key = profile ?? this.opts.browser.sessionProfile;
    let client = this.clients.get(key);
    if (!client) {
      const clientOpts: BetterWrightClientOptions = {
        profile: key,
        headless: this.opts.browser.headless,
      };
      client =
        this.opts.browser.implementation === 'real'
          ? new RealBetterWrightClient(clientOpts)
          : new MockBetterWrightClient(clientOpts);
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
