import type { Logger } from './logger.js';

export interface ProgressOptions {
  /** 长任务持续多久后再次提示。默认 15 秒。 */
  heartbeatMs?: number;
  /** 测试用时间源。 */
  now?: () => number;
}

/**
 * 为耗时阶段提供即时反馈和心跳日志。
 *
 * 所有输出都经过 Logger，因此遵守 --json、--log-level 和 silent 契约。
 */
export async function withProgress<T>(
  logger: Logger,
  label: string,
  operation: () => Promise<T>,
  options: ProgressOptions = {},
): Promise<T> {
  if (!logger.isEnabled('info')) {
    return operation();
  }

  const now = options.now ?? Date.now;
  const startedAt = now();
  const heartbeatMs = options.heartbeatMs ?? 15_000;
  logger.info(`开始：${label}`);

  const heartbeat = setInterval(() => {
    logger.info(`仍在进行：${label}（${formatDuration(now() - startedAt)}）`);
  }, heartbeatMs);
  heartbeat.unref();

  try {
    const result = await operation();
    logger.info(`完成：${label}（${formatDuration(now() - startedAt)}）`);
    return result;
  } catch (error) {
    logger.warn(`未完成：${label}（${formatDuration(now() - startedAt)}）`);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs}ms`;
  return `${(durationMs / 1_000).toFixed(1)}s`;
}
