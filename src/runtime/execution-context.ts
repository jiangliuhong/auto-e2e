/**
 * 执行上下文：一次命令运行期间的全局配置与状态。
 *
 * 所有模块通过它读取目标项目根目录、是否 JSON 模式、是否非交互等，
 * 避免到处读取 process.argv / process.cwd。
 */
import path from 'node:path';
import { Logger, setDefaultLogger } from './logger.js';

export interface ExecutionContextOptions {
  /** 目标项目根目录，默认 process.cwd()。 */
  projectRoot?: string;
  /** JSON 模式：stdout 只输出最终 JSON。 */
  json?: boolean;
  /** 非交互模式：禁止等待用户输入。 */
  nonInteractive?: boolean;
  /** 日志级别覆盖。 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

export class ExecutionContext {
  readonly projectRoot: string;
  readonly json: boolean;
  readonly nonInteractive: boolean;
  readonly logger: Logger;

  constructor(opts: ExecutionContextOptions = {}) {
    this.projectRoot = path.resolve(opts.projectRoot ?? process.cwd());
    this.json = opts.json ?? false;
    this.nonInteractive = opts.nonInteractive ?? false;
    this.logger = new Logger({
      level: opts.logLevel,
      json: this.json,
      prefix: 'auto-e2e',
    });
    // 同步全局默认 logger，便于非命令路径调用。
    setDefaultLogger(this.logger);
  }

  /** 将相对路径解析到目标项目根目录。 */
  resolve(relativePath: string): string {
    return path.resolve(this.projectRoot, relativePath);
  }

  childLogger(prefix: string): Logger {
    return this.logger.child(prefix);
  }
}

/**
 * 全局上下文单例。cli.ts 在命令真正执行前设置它，
 * 其余模块在需要时通过 getExecutionContext() 取用。
 */
let currentContext: ExecutionContext | undefined;

export function setExecutionContext(ctx: ExecutionContext): void {
  currentContext = ctx;
}

export function getExecutionContext(): ExecutionContext {
  if (!currentContext) {
    currentContext = new ExecutionContext();
  }
  return currentContext;
}
