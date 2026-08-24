import { describe, expect, it, vi } from 'vitest';
import { Logger } from '../../src/runtime/logger.js';
import { withProgress } from '../../src/runtime/progress.js';

function makeLogger(options: { json?: boolean } = {}) {
  const lines: string[] = [];
  return {
    lines,
    logger: new Logger({ ...options, sink: (line) => void lines.push(line) }),
  };
}

describe('withProgress', () => {
  it('输出开始、心跳和完成耗时', async () => {
    vi.useFakeTimers();
    let now = 0;
    const { lines, logger } = makeLogger();
    const operation = withProgress(
      logger,
      '探索页面',
      async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
        return 'ok';
      },
      { heartbeatMs: 10, now: () => now },
    );

    now = 10;
    await vi.advanceTimersByTimeAsync(10);
    now = 20;
    await vi.advanceTimersByTimeAsync(10);

    await expect(operation).resolves.toBe('ok');
    expect(lines).toEqual([
      '[INFO] 开始：探索页面',
      '[INFO] 仍在进行：探索页面（10ms）',
      '[INFO] 仍在进行：探索页面（20ms）',
      '[INFO] 完成：探索页面（20ms）',
    ]);
    vi.useRealTimers();
  });

  it('JSON 默认静默时不输出进度', async () => {
    const { lines, logger } = makeLogger({ json: true });
    await expect(withProgress(logger, '分析需求', async () => 42)).resolves.toBe(42);
    expect(lines).toEqual([]);
  });

  it('失败时清理心跳并保留原错误', async () => {
    vi.useFakeTimers();
    const { lines, logger } = makeLogger();
    const error = new Error('boom');

    await expect(
      withProgress(logger, '生成测试', async () => {
        throw error;
      }),
    ).rejects.toBe(error);

    await vi.runOnlyPendingTimersAsync();
    expect(lines.some((line) => line.includes('未完成：生成测试'))).toBe(true);
    expect(lines.some((line) => line.includes('仍在进行'))).toBe(false);
    vi.useRealTimers();
  });
});
