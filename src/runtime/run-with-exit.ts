/**
 * 命令执行公共工具：统一处理上下文装配、JSON 输出与进程退出码。
 */
import { AutoE2EError, type ExitCodeValue } from './exit-codes.js';
import { ExecutionContext, setExecutionContext } from './execution-context.js';
import { getDefaultLogger } from './logger.js';

export interface RunOptions {
  projectRoot?: string;
  config?: string;
  json?: boolean;
  nonInteractive?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

/**
 * 包装一个命令处理函数：
 * - 装配 ExecutionContext
 * - 捕获 AutoE2EError 并映射退出码
 * - JSON 模式下把结果对象作为最终 JSON 打印到 stdout
 *
 * 返回进程应使用的退出码。
 */
export async function runCommand<T>(
  opts: RunOptions,
  fn: (ctx: ExecutionContext) => Promise<CommandResult<T>>,
): Promise<number> {
  const ctx = new ExecutionContext(opts);
  setExecutionContext(ctx);
  const logger = ctx.logger;

  try {
    const result = await fn(ctx);
    if (ctx.json) {
      // JSON 模式：stdout 只输出最终 JSON。
      process.stdout.write(JSON.stringify(result.json ?? null, null, 2) + '\n');
    } else if (result.message) {
      process.stderr.write(result.message + '\n');
    }
    return result.exitCode;
  } catch (err) {
    if (err instanceof AutoE2EError) {
      logger.error(`${err.message}`);
      if (ctx.json) {
        const payload = {
          ok: false,
          exitCode: err.exitCode,
          error: err.message,
        };
        process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
      }
      return err.exitCode;
    }
    // 工具自身异常。
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    if (ctx.json) {
      process.stdout.write(
        JSON.stringify({ ok: false, exitCode: 3, error: message }, null, 2) + '\n',
      );
    }
    return 3;
  }
}

export interface CommandResult<T = unknown> {
  exitCode: ExitCodeValue;
  /** JSON 模式下打印到 stdout 的对象。 */
  json?: T;
  /** 非 JSON 模式下打印到 stderr 的人类可读信息。 */
  message?: string;
}

export { getDefaultLogger };
