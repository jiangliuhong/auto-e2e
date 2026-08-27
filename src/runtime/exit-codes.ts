/**
 * auto-e2e 统一退出码定义。
 *
 * 退出码是外部调用方判断 auto-e2e 执行结果的稳定机器接口，
 * 任何变更都需要同步更新 README 和使用文档。
 *
 * @see plan.md §14
 */
export const ExitCode = {
  /** 验收全部通过 */
  Ok: 0,
  /** 验收执行完成，但存在失败 */
  TestsFailed: 1,
  /** 环境、配置、登录或浏览器阻塞 */
  Blocked: 2,
  /** 工具自身异常 */
  ToolError: 3,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** 退出码的语义描述，用于日志和报告。 */
export const EXIT_CODE_MESSAGES: Record<number, string> = {
  [ExitCode.Ok]: '验收全部通过',
  [ExitCode.TestsFailed]: '验收执行完成，但存在失败',
  [ExitCode.Blocked]: '环境、配置、登录或浏览器阻塞',
  [ExitCode.ToolError]: '工具自身异常',
};

/**
 * 自定义错误类型，携带退出码。
 * 命令编排层捕获后可直接用其 code 作为进程退出码。
 */
export class AutoE2EError extends Error {
  readonly exitCode: ExitCodeValue;
  override readonly cause?: unknown;

  constructor(exitCode: ExitCodeValue, message: string, cause?: unknown) {
    super(message);
    this.name = 'AutoE2EError';
    this.exitCode = exitCode;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
