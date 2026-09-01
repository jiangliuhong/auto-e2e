import { describe, expect, it } from 'vitest';
import { AutoE2EError, ExitCode } from '../../src/runtime/exit-codes.js';

describe('public exit codes', () => {
  it('只暴露通过、失败、阻塞和工具异常四种语义', () => {
    expect(new Set(Object.values(ExitCode))).toEqual(new Set([0, 1, 2, 3]));
    expect(ExitCode.Ok).toBe(0);
    expect(ExitCode.TestsFailed).toBe(1);
    expect(ExitCode.Blocked).toBe(2);
    expect(ExitCode.ToolError).toBe(3);
  });

  it('错误携带稳定退出码与 cause', () => {
    const cause = new Error('root');
    const error = new AutoE2EError(ExitCode.Blocked, 'blocked', cause);
    expect(error.exitCode).toBe(2);
    expect(error.cause).toBe(cause);
  });
});
