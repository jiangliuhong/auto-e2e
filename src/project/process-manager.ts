/**
 * 目标应用进程管理（plan §12.1）。
 *
 * 策略：
 * - 如果 healthUrl 已可达，不重复启动。
 * - 否则后台执行 startCommand，轮询 healthUrl。
 * - 达到 startupTimeout 仍未健康 → 抛 AutoE2EError(AppStartupFailed, 2)。
 * - 由本管理器启动的进程必须在执行结束后关闭。
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { AutoE2EError } from '../runtime/exit-codes.js';
import { probeHealth, waitForHealthy, type FetchFn } from './health-checker.js';
import type { Logger } from '../runtime/logger.js';

export interface ManagedApp {
  /** 是否由本管理器启动（决定是否需要关闭）。 */
  startedByUs: boolean;
  /** 底层子进程（若由本管理器启动）。 */
  child?: ChildProcess;
  /** 关闭由本管理器启动的进程。重复调用安全。 */
  stop: () => Promise<void>;
}

export interface StartAppOptions {
  projectRoot: string;
  startCommand: string;
  healthUrl: string;
  startupTimeout: number;
  fetchFn?: FetchFn;
  logger?: Logger;
  /** 启动后轮询间隔。 */
  healthCheckIntervalMs?: number;
  /** 注入的 spawn 实现（测试用）。 */
  spawnImpl?: typeof spawn;
}

export async function ensureAppRunning(opts: StartAppOptions): Promise<ManagedApp> {
  const logger = opts.logger;
  const fetchFn = opts.fetchFn;

  // 已健康则不启动。
  if (await probeHealth(opts.healthUrl, fetchFn)) {
    logger?.info(`应用已在运行（${opts.healthUrl} 可达），跳过启动`);
    return { startedByUs: false, stop: async () => undefined };
  }

  logger?.info(`启动目标应用: ${opts.startCommand}`);
  const spawnFn = opts.spawnImpl ?? spawn;
  const child = spawnFn(opts.startCommand, {
    cwd: opts.projectRoot,
    shell: true,
    stdio: 'ignore',
    detached: false,
  });

  let stopped = false;
  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    try {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    } catch {
      // 忽略。
    }
  };

  // 轮询健康。
  const result = await waitForHealthy({
    healthUrl: opts.healthUrl,
    timeoutMs: opts.startupTimeout,
    intervalMs: opts.healthCheckIntervalMs,
    fetchFn,
  });

  if (!result.healthy) {
    await stop();
    throw new AutoE2EError(
      2,
      `应用启动失败：在 ${opts.startupTimeout}ms 内 ${opts.healthUrl} 仍不可达`,
    );
  }

  logger?.info(`应用已就绪（等待 ${result.waitedMs}ms）`);
  return { startedByUs: true, child, stop };
}
