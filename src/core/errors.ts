// RuntimeError 是 Runtime 对外稳定的错误模型。
// 对齐 RUNTIME_SPEC.md「错误模型」一节。
// 所有 provider 的原始错误都应通过 utils/errors.ts 的 toRuntimeError() 归一化为此结构,
// 避免向调用方泄漏原始异常。

export interface RuntimeError {
  /** 机器可读的错误码,使用小写蛇形,例如 `env_not_ready`。 */
  code: string
  /** 人类可读的错误信息。 */
  message: string
  /** 导致该错误的原始原因(可选,通常是原始 error.message)。 */
  cause?: string
  /** 该错误是否可恢复(调用方可重试)。 */
  recoverable: boolean
  /** 与该错误相关的额外结构化细节。 */
  details?: Record<string, unknown>
}

/**
 * 创建一个 RuntimeError。
 * 建议使用统一的 code 常量,以便上层匹配。
 */
export function runtimeError(input: {
  code: string
  message: string
  cause?: string
  recoverable?: boolean
  details?: Record<string, unknown>
}): RuntimeError {
  return {
    code: input.code,
    message: input.message,
    ...(input.cause !== undefined ? { cause: input.cause } : {}),
    recoverable: input.recoverable ?? false,
    ...(input.details !== undefined ? { details: input.details } : {}),
  }
}

/**
 * 标记某能力尚未实现。Observer/Executor/Feedback 等后续阶段模块在阶段 1–3 中
 * 以此返回,而非抛出裸异常。
 */
export function notImplementedError(capability: string): RuntimeError {
  return runtimeError({
    code: 'not_implemented',
    message: `能力尚未实现:${capability}`,
    recoverable: false,
    details: { capability },
  })
}
