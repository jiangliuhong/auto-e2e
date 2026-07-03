// 结构化、人类与机器都可读的日志工具。
// 输出纯文本,避免依赖特定平台格式;保持确定性,便于断言。

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

let currentLevel: LogLevel = 'info'

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/** 设置全局日志级别。 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

function shouldLog(level: LogLevel): boolean {
  return ORDER[level] >= ORDER[currentLevel]
}

function write(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
  if (!shouldLog(level)) return
  const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `
  const text = extra ? `${prefix}${message} ${JSON.stringify(extra)}` : `${prefix}${message}`
  // eslint-disable-next-line no-console
  console[
    level === 'debug' ? 'log' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log'
  ](text)
}

export const log = {
  debug: (message: string, extra?: Record<string, unknown>) => write('debug', message, extra),
  info: (message: string, extra?: Record<string, unknown>) => write('info', message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => write('warn', message, extra),
  error: (message: string, extra?: Record<string, unknown>) => write('error', message, extra),
}
