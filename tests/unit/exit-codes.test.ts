import { describe, it, expect } from 'vitest';
import { ExitCode, EXIT_CODE_MESSAGES, AutoE2EError } from '../../src/runtime/exit-codes.js';

describe('exit codes', () => {
  it('定义了 plan §14 的全部退出码', () => {
    expect(ExitCode.Ok).toBe(0);
    expect(ExitCode.TestsFailed).toBe(1);
    expect(ExitCode.AppStartupFailed).toBe(2);
    expect(ExitCode.GenerationFailed).toBe(3);
    expect(ExitCode.InsufficientRequirement).toBe(4);
    expect(ExitCode.AuthFailed).toBe(5);
    expect(ExitCode.BrowserFailed).toBe(6);
    expect(ExitCode.ConfigError).toBe(7);
    expect(ExitCode.PlaywrightError).toBe(8);
    expect(ExitCode.UnknownError).toBe(9);
  });

  it('每个退出码都有对应消息', () => {
    for (const code of Object.values(ExitCode)) {
      expect(EXIT_CODE_MESSAGES[code]).toBeTruthy();
    }
  });
});

describe('AutoE2EError', () => {
  it('携带退出码和消息', () => {
    const err = new AutoE2EError(ExitCode.ConfigError, '配置错误');
    expect(err.exitCode).toBe(ExitCode.ConfigError);
    expect(err.message).toBe('配置错误');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AutoE2EError');
  });

  it('可选携带 cause', () => {
    const cause = new Error('原始');
    const err = new AutoE2EError(ExitCode.UnknownError, '失败', cause);
    expect(err.cause).toBe(cause);
  });
});
