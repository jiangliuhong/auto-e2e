/**
 * BrowserClient 接口。
 *
 * 抽象出探索所需的最小能力，支持在 mock 与原生 Playwright 实现间切换。
 */

/** run() 返回的结果信封。 */
export interface BrowserRunResult<T = unknown> {
  ok: boolean;
  /** 代码或表达式返回的值。 */
  result?: T;
  /** 错误信息（ok=false 时）。 */
  error?: string;
  /** 步骤记录（可选）。 */
  steps?: unknown[];
  /** proof 截图路径（可选）。 */
  proofPath?: string;
  /** 记录的截图、下载等产物。 */
  artifacts?: Array<{ kind?: string; path?: string; media?: string }>;
}

/** 兼容旧命名别名。 */
export type BwRunResult<T = unknown> = BrowserRunResult<T>;

export interface BrowserRunOptions {
  session?: string;
}

export type BwRunOptions = BrowserRunOptions;

export interface BrowserClientOptions {
  profile?: string;
  headless?: boolean;
  channel?: 'chrome' | 'msedge' | 'chromium';
  timeout?: number;
  artifactsDir?: string;
}

export type BetterWrightClientOptions = BrowserClientOptions;

export interface BrowserLiveViewResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export type BwLiveViewResult = BrowserLiveViewResult;

export interface BrowserHandoffResult {
  ok: boolean;
  action?: 'done' | 'cancel' | 'timeout';
  error?: string;
}

export type BwHandoffResult = BrowserHandoffResult;

export interface BrowserClient {
  /** 执行一段沙箱化/脚本化 Playwright 操作。 */
  run<T = unknown>(code: string, options?: BrowserRunOptions): Promise<BrowserRunResult<T>>;
  /** 启动人工认证接管。 */
  startLiveView(options?: {
    expose?: 'local';
    interactive?: boolean;
    session?: string;
  }): Promise<BrowserLiveViewResult>;
  /** 等待用户在浏览器中完成或取消人工接管。 */
  waitForHandoff(options?: {
    session?: string;
    prompt?: string;
    timeout?: number;
  }): Promise<BrowserHandoffResult>;
  /** 停止人工接管。 */
  stopLiveView(): Promise<void>;
  /** 关闭浏览器与上下文。 */
  close(): Promise<void>;
}

export type BetterWrightClient = BrowserClient;
