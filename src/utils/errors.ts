// 把 provider/系统抛出的原始错误归一化为 RuntimeError。
// 对齐 RUNTIME_SPEC.md「错误模型」与 PROVIDER_GUIDE.md「避免抛出原始错误」的要求。

import { runtimeError } from '../core/errors.js'
import type { RuntimeError } from '../core/errors.js'

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * 把任意 unknown 错误转换为 RuntimeError。
 * @param code 默认错误码。
 * @param message 对外信息(默认取原始 message)。
 */
export function toRuntimeError(
  err: unknown,
  opts: {
    code?: string
    message?: string
    recoverable?: boolean
    details?: Record<string, unknown>
  } = {},
): RuntimeError {
  return runtimeError({
    code: opts.code ?? 'runtime_error',
    message: opts.message ?? asString(err),
    ...(err instanceof Error || typeof err === 'string' ? { cause: asString(err) } : {}),
    recoverable: opts.recoverable ?? false,
    ...(opts.details ? { details: opts.details } : {}),
  })
}
