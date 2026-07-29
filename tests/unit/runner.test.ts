import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { runPlaywright } from '../../src/playwright/runner.js';
import type { ReporterConfigOptions } from '../../src/playwright/reporter-config.js';

/**
 * 伪造的 spawn：先把报告内容写到 jsonReportPath，再触发 close 回调。
 * reportContent 为 null 表示不写报告（模拟报告缺失）。
 */
function fakeSpawn(reportContent: string | null) {
  return (
    _cmd: string,
    _args: string[],
    _opts: SpawnOptions,
  ): ChildProcess => {
    const handlers: Record<string, Array<(code: number | null) => void>> = {};
    const child = {
      on(event: string, cb: (code: number | null) => void) {
        (handlers[event] ??= []).push(cb);
        return child;
      },
    } as unknown as ChildProcess;

    // 异步：先写报告，再触发 close。
    setTimeout(async () => {
      const reportPath = (child as unknown as { _reportPath?: string })._reportPath;
      if (reportContent !== null && reportPath) {
        await fs.mkdir(path.dirname(reportPath), { recursive: true }).catch(() => undefined);
        await fs.writeFile(reportPath, reportContent, 'utf8').catch(() => undefined);
      }
      for (const cb of handlers['close'] ?? []) cb(0);
    }, 0);

    return child;
  };
}

/** 把 reportPath 挂到 spawn 返回的 child 上，供写报告使用。 */
function spawnWithReportPath(reportContent: string | null, reportPath: string) {
  const spawn = fakeSpawn(reportContent);
  const wrapped = (
    cmd: string,
    args: string[],
    opts: SpawnOptions,
  ): ChildProcess => {
    const child = spawn(cmd, args, opts);
    (child as unknown as { _reportPath?: string })._reportPath = reportPath;
    return child;
  };
  return wrapped;
}

const baseOpts = (reportDir: string): ReporterConfigOptions => ({
  jsonReportPath: path.join(reportDir, 'playwright.json'),
  junitReportPath: path.join(reportDir, 'junit.xml'),
  htmlReportDir: path.join(reportDir, 'html'),
  formats: ['console', 'json', 'html', 'junit'],
  retries: 1,
  workers: 1,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
});

describe('runPlaywright', () => {
  it('执行前删除旧报告，防止本次失败读取上次结果', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-runner-'));
    const opts = baseOpts(path.join(tmp, 'latest'));
    await fs.mkdir(path.dirname(opts.jsonReportPath), { recursive: true });
    await fs.writeFile(
      opts.jsonReportPath,
      JSON.stringify({
        suites: [
          {
            specs: [
              {
                title: '上次通过',
                ok: true,
                tests: [{ results: [{ status: 'passed', duration: 1 }] }],
              },
            ],
          },
        ],
      }),
    );

    const outcome = await runPlaywright({
      projectRoot: tmp,
      reporter: opts,
      spawnImpl: spawnWithReportPath(null, opts.jsonReportPath) as never,
    });

    expect(outcome.exitCode).toBe(8);
    expect(outcome.summary.total).toBe(0);
  });

  it('spawn error 会 reject 为 PlaywrightError，而不是抛出未捕获异常', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-runner-'));
    const opts = baseOpts(path.join(tmp, 'latest'));
    const errorSpawn = (() => {
      const handlers: Record<string, Array<(value: unknown) => void>> = {};
      const child = {
        on(event: string, cb: (value: unknown) => void) {
          (handlers[event] ??= []).push(cb);
          if (event === 'error') {
            queueMicrotask(() => cb(new Error('ENOENT')));
          }
          return child;
        },
      };
      return child as unknown as ChildProcess;
    }) as never;

    await expect(
      runPlaywright({
        projectRoot: tmp,
        reporter: opts,
        spawnImpl: errorSpawn,
      }),
    ).rejects.toMatchObject({ exitCode: 8 });
  });

  it('total===0 时返回 exitCode 8，绝不误判为通过（V-7.2）', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-runner-'));
    const opts = baseOpts(path.join(tmp, 'latest'));

    // Playwright 返回一个没有任何 spec 的报告（total=0）。
    const emptyReport = JSON.stringify({ suites: [], stats: {} });
    const outcome = await runPlaywright({
      projectRoot: tmp,
      reporter: opts,
      mode: 'incremental',
      testFiles: [path.join(tmp, 'a.spec.ts')],
      spawnImpl: spawnWithReportPath(emptyReport, opts.jsonReportPath) as never,
    });

    expect(outcome.exitCode).toBe(8);
    expect(outcome.summary.total).toBe(0);
  });

  it('有失败用例时正确统计失败数（V-7.2 回归）', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-runner-'));
    const opts = baseOpts(path.join(tmp, 'latest'));

    const failedReport = JSON.stringify({
      suites: [
        {
          specs: [
            {
              title: '失败用例',
              ok: false,
              tests: [
                {
                  results: [{ status: 'failed', duration: 10, error: { message: '断言失败' } }],
                },
              ],
            },
          ],
        },
      ],
    });
    const outcome = await runPlaywright({
      projectRoot: tmp,
      reporter: opts,
      mode: 'incremental',
      spawnImpl: spawnWithReportPath(failedReport, opts.jsonReportPath) as never,
    });

    expect(outcome.summary.total).toBe(1);
    expect(outcome.summary.failed).toBe(1);
    // total>0，exitCode 反映进程退出码（0，因为 spawn mock 总是返回 0）。
    expect(outcome.exitCode).toBe(0);
  });
});
