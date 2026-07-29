/**
 * auto-e2e 统一退出码定义。
 *
 * 退出码是 Codex 判断 auto-e2e 执行结果的唯一稳定机器接口，
 * 任何变更都需要同步更新 README 和 Codex 集成示例。
 *
 * @see plan.md §14
 */
export const ExitCode = {
  /** 测试全部通过 */
  Ok: 0,
  /** 测试执行完成，但存在失败 */
  TestsFailed: 1,
  /** 应用环境启动失败 */
  AppStartupFailed: 2,
  /** 测试生成失败 */
  GenerationFailed: 3,
  /** 需求或验收标准信息不足 */
  InsufficientRequirement: 4,
  /** 登录或认证失败 */
  AuthFailed: 5,
  /** BetterWright 或浏览器执行失败 */
  BrowserFailed: 6,
  /** 配置错误 */
  ConfigError: 7,
  /** Playwright 执行异常 */
  PlaywrightError: 8,
  /** 未知错误 */
  UnknownError: 9,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** 退出码的语义描述，用于日志和报告。 */
export const EXIT_CODE_MESSAGES: Record<number, string> = {
  [ExitCode.Ok]: '测试全部通过',
  [ExitCode.TestsFailed]: '测试执行完成，但存在失败',
  [ExitCode.AppStartupFailed]: '应用环境启动失败',
  [ExitCode.GenerationFailed]: '测试生成失败',
  [ExitCode.InsufficientRequirement]: '需求或验收标准信息不足',
  [ExitCode.AuthFailed]: '登录或认证失败',
  [ExitCode.BrowserFailed]: 'BetterWright 或浏览器执行失败',
  [ExitCode.ConfigError]: '配置错误',
  [ExitCode.PlaywrightError]: 'Playwright 执行异常',
  [ExitCode.UnknownError]: '未知错误',
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
