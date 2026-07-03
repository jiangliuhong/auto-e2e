// CLI 输出与退出码工具。
// 统一成功/失败/JSON 打印风格;Runtime 错误序列化后打印。

import type { RuntimeError } from '../core/errors.js'

export function printSuccess(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`✓ ${message}`)
}

export function printFailure(message: string): void {
  // eslint-disable-next-line no-console
  console.error(`✗ ${message}`)
}

export function printInfo(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message)
}

/** 打印 RuntimeError 的结构化信息。 */
export function printRuntimeError(err: RuntimeError): void {
  printFailure(`${err.message} (${err.code})`)
  if (err.cause) {
    // eslint-disable-next-line no-console
    console.error(`  cause: ${err.cause}`)
  }
  if (err.recoverable) {
    // eslint-disable-next-line no-console
    console.error('  该错误可恢复,可重试。')
  }
}

/**
 * CLI 退出处理。process.exit 由 index.ts 顶层统一调用;
 * 此函数仅返回期望的退出码,便于测试。
 */
export function exitCodeForErrors(errors: RuntimeError[]): number {
  return errors.length > 0 ? 1 : 0
}
