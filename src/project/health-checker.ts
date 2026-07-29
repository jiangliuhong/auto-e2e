/**
 * 应用健康检查（plan §12.1）。
 *
 * 轮询 healthUrl 直到返回 2xx，超时则视为启动失败。
 * 使用 fetch（Node 22 内置），可注入自定义 fetch 便于测试。
 */
export type FetchFn = (url: string, opts?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

const defaultFetch: FetchFn = async (url, opts) => {
  const res = await fetch(url, opts);
  return { ok: res.ok, status: res.status };
};

export interface HealthCheckOptions {
  healthUrl: string;
  /** 总超时（ms）。 */
  timeoutMs: number;
  /** 轮询间隔（ms）。 */
  intervalMs?: number;
  fetchFn?: FetchFn;
  /** 用于测试注入的 fake now。 */
  now?: () => number;
  /** 用于测试注入的 sleep。 */
  sleep?: (ms: number) => Promise<void>;
}

export interface HealthCheckResult {
  healthy: boolean;
  /** 健康时为首次成功时间戳；不健康时为放弃时间戳。 */
  checkedAt: number;
  /** 总等待时长（ms）。 */
  waitedMs: number;
  lastStatus?: number;
}

export async function waitForHealthy(opts: HealthCheckOptions): Promise<HealthCheckResult> {
  const fetchFn = opts.fetchFn ?? defaultFetch;
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const intervalMs = opts.intervalMs ?? 1000;

  const start = now();
  const deadline = start + opts.timeoutMs;
  let lastStatus: number | undefined;

  while (now() < deadline) {
    try {
      const res = await fetchFn(opts.healthUrl);
      lastStatus = res.status;
      if (res.ok) {
        return { healthy: true, checkedAt: now(), waitedMs: now() - start, lastStatus };
      }
    } catch {
      // 连接失败：继续轮询。
    }
    await sleep(intervalMs);
  }

  return { healthy: false, checkedAt: now(), waitedMs: now() - start, lastStatus };
}

/** 单次健康探测（不轮询）。 */
export async function probeHealth(
  healthUrl: string,
  fetchFn: FetchFn = defaultFetch,
): Promise<boolean> {
  try {
    const res = await fetchFn(healthUrl);
    return res.ok;
  } catch {
    return false;
  }
}
