/**
 * auto-e2e 统一日志。
 *
 * 关键约束（plan §14）：
 * - 错误输出到 stderr。
 * - JSON 模式下 stdout 只输出最终 JSON，过程日志全部走 stderr 且默认静默。
 *
 * 因此本 logger 永远写 stderr，绝不污染 stdout。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export interface LoggerOptions {
  /** 最低输出级别，低于该级别的日志被丢弃。 */
  level?: LogLevel;
  /** JSON 模式：除 error 外的过程日志默认静默，避免干扰 stdout 的最终 JSON。 */
  json?: boolean;
  /** 可选的前缀，例如命令名或 taskId。 */
  prefix?: string;
  /** 用于测试注入的自定义输出流，默认 stderr。 */
  sink?: (line: string) => void;
}

const LEVEL_TAG: Record<Exclude<LogLevel, 'silent'>, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

export class Logger {
  private readonly level: LogLevel;
  private readonly json: boolean;
  private readonly prefix: string;
  private readonly sink: (line: string) => void;

  constructor(opts: LoggerOptions = {}) {
    this.json = opts.json ?? false;
    this.prefix = opts.prefix ?? '';
    this.sink = opts.sink ?? ((line: string) => process.stderr.write(line + '\n'));
    // JSON 模式下默认将过程日志降到 silent，只有显式 error 才输出到 stderr。
    if (opts.level) {
      this.level = opts.level;
    } else if (this.json) {
      this.level = 'silent';
    } else {
      this.level = 'info';
    }
  }

  child(prefix: string): Logger {
    const next = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({
      level: this.level,
      json: this.json,
      prefix: next,
      sink: this.sink,
    });
  }

  private shouldEmit(level: Exclude<LogLevel, 'silent'>): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  private format(level: Exclude<LogLevel, 'silent'>, msg: string): string {
    const tag = LEVEL_TAG[level];
    const head = this.prefix ? `[${tag}] ${this.prefix}` : `[${tag}]`;
    return `${head} ${msg}`;
  }

  debug(msg: string): void {
    if (this.shouldEmit('debug')) this.sink(this.format('debug', msg));
  }

  info(msg: string): void {
    if (this.shouldEmit('info')) this.sink(this.format('info', msg));
  }

  warn(msg: string): void {
    if (this.shouldEmit('warn')) this.sink(this.format('warn', msg));
  }

  /**
   * error 级别即使在 JSON 模式（silent）下也始终输出到 stderr。
   * 这保证 JSON 模式 stdout 纯净的同时，关键错误仍可见。
   */
  error(msg: string): void {
    this.sink(this.format('error', msg));
  }
}

/** 全局默认 logger，命令启动时会被覆盖。 */
let defaultLogger: Logger = new Logger();

export function getDefaultLogger(): Logger {
  return defaultLogger;
}

export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}
