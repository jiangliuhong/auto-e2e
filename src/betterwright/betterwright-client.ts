/**
 * BetterWrightClient 接口（plan §3.2, §10）。
 *
 * BetterWright 通过 `bw.run(playwrightCodeString, { session })` 执行沙箱化
 * Playwright 代码并返回 `{ ok, result, ... }` 信封。本接口抽象出探索所需的最小能力，
 * 便于在 mock 与真实实现间切换。
 */

/** run() 返回的结果信封。 */
export interface BwRunResult<T = unknown> {
  ok: boolean;
  /** 代码字符串中 return 的值。 */
  result?: T;
  /** 错误信息（ok=false 时）。 */
  error?: string;
  /** 步骤记录（可选）。 */
  steps?: unknown[];
  /** proof 截图路径（可选）。 */
  proofPath?: string;
  /** BetterWright 记录的截图、下载等产物。 */
  artifacts?: Array<{ kind?: string; path?: string; media?: string }>;
}

export interface BwRunOptions {
  session?: string;
}

export interface BetterWrightClientOptions {
  profile?: string;
  headless?: boolean;
}

export interface BetterWrightClient {
  /** 执行一段沙箱化 Playwright 代码字符串。 */
  run<T = unknown>(code: string, options?: BwRunOptions): Promise<BwRunResult<T>>;
  /** 关闭浏览器与守护进程。 */
  close(): Promise<void>;
}
