// 就绪探针:轮询 baseUrl 直到返回 <500 或超时。
// 使用全局 fetch(Node >= 18 内置)。无任意 sleep,使用显式 interval 与 deadline。

import { runtimeError } from '../../core/errors.js'
import type { RuntimeError } from '../../core/errors.js'
import type { HealthCheckResult } from './health-check.js'

export interface WaitForReadyOptions {
  /** 总超时(毫秒),默认 30000。 */
  timeoutMs?: number
  /** 轮询间隔(毫秒),默认 500。 */
  intervalMs?: number
}

export interface WaitForReadyResult {
  ok: boolean
  error?: RuntimeError
}

/**
 * 探测一次 baseUrl。
 * 返回 HealthCheckResult;失败(网络错误)返回 { ok: false }。
 */
export async function probeOnce(baseUrl: string, timeoutMs = 3000): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const res = await fetch(baseUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return {
      ok: res.status < 500,
      status: res.status,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 轮询等待 baseUrl 就绪。
 */
export async function waitForReady(
  baseUrl: string,
  opts: WaitForReadyOptions = {},
): Promise<WaitForReadyResult> {
  const timeoutMs = opts.timeoutMs ?? 30_000
  const intervalMs = opts.intervalMs ?? 500
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const probe = await probeOnce(baseUrl, Math.min(3000, deadline - Date.now()))
    if (probe.ok) {
      return { ok: true }
    }
    // 未就绪:等待 intervalMs 后重试(显式,非任意 sleep)
    await sleep(intervalMs)
  }

  return {
    ok: false,
    error: runtimeError({
      code: 'env_not_ready',
      message: `等待 ${baseUrl} 就绪超时(${timeoutMs}ms)`,
      recoverable: true,
      details: { baseUrl, timeoutMs },
    }),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
