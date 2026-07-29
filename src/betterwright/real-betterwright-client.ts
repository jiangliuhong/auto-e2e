/**
 * RealBetterWrightClient：封装真实 betterwright 包。
 *
 * betterwright API：
 *   const bw = new BetterWright({ profile });
 *   await bw.run("await page.goto('http://...')", { session });
 *   const { result } = await bw.run("return page.title()", { session });
 *   await bw.close();
 *
 * betterwright 为可选依赖，未安装时抛 BrowserFailed。
 */
import type {
  BetterWrightClient,
  BetterWrightClientOptions,
  BwRunResult,
  BwRunOptions,
} from './betterwright-client.js';
import { AutoE2EError } from '../runtime/exit-codes.js';

// betterwright 包未声明类型时，使用最小 any 类型。
type BetterWrightInstance = {
  run: (code: string, options?: { session?: string }) => Promise<BwRunResult>;
  close: () => Promise<void>;
};

export class RealBetterWrightClient implements BetterWrightClient {
  private instance?: BetterWrightInstance;
  private readonly opts: BetterWrightClientOptions;

  constructor(opts: BetterWrightClientOptions = {}) {
    this.opts = opts;
  }

  private async getInstance(): Promise<BetterWrightInstance> {
    if (this.instance) return this.instance;
    try {
      const mod = (await import('betterwright')) as { BetterWright: new (opts?: BetterWrightClientOptions) => BetterWrightInstance };
      this.instance = new mod.BetterWright(this.opts);
      return this.instance;
    } catch (err) {
      throw new AutoE2EError(
        6,
        `无法加载 betterwright：${err instanceof Error ? err.message : String(err)}。请先执行 betterwright init。`,
      );
    }
  }

  async run<T = unknown>(code: string, options?: BwRunOptions): Promise<BwRunResult<T>> {
    const inst = await this.getInstance();
    try {
      const res = await inst.run(code, options?.session ? { session: options.session } : undefined);
      return res as BwRunResult<T>;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async close(): Promise<void> {
    try {
      await this.instance?.close();
    } finally {
      this.instance = undefined;
    }
  }
}
