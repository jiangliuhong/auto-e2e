import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import {
  PlaywrightExecutor,
  type PlaywrightRunOutput,
} from '../../../src/runtime/executor/playwright-executor.js'
import { FsStorageService } from '../../../src/runtime/storage/fs-storage.js'

let root: string
let storage: FsStorageService

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-exec-'))
  storage = new FsStorageService(root)
  await storage.ensureLayout()
})

afterEach(async () => {
  await fse.remove(root)
})

/** 构造一段 Playwright JSON reporter 输出(stdout)。 */
function jsonReport(suites: unknown[], extra = ''): string {
  return `${extra}{ "suites": ${JSON.stringify(suites)} }`
}

/** 带有可注入 runPlaywright 的 Executor 工厂。 */
function makeExecutor(
  runPlaywright: (args: string[], cwd: string) => Promise<PlaywrightRunOutput>,
) {
  return new PlaywrightExecutor({ projectRoot: root, storage, runPlaywright })
}

describe('PlaywrightExecutor.run', () => {
  it('全部通过 → status=passed,summary 正确', async () => {
    const report = jsonReport([
      {
        title: 'login.spec.ts',
        file: 'e2e/login.spec.ts',
        line: 1,
        specs: [
          {
            title: 'should pass',
            tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
          },
        ],
      },
    ])
    const exec = makeExecutor(async () => ({ stdout: report, stderr: '', exitCode: 0 }))

    const result = await exec.run()

    expect(result.status).toBe('passed')
    expect(result.summary).toEqual({ total: 1, passed: 1, failed: 0, skipped: 0 })
    expect(result.failures).toEqual([])
    expect(result.errors).toEqual([])
    expect(result.runId).toMatch(/^run_\d{3}$/)
    expect(result.startedAt).not.toBe('')
    expect(result.endedAt).not.toBe('')
  })

  it('含失败 → status=failed,提取 failure 的 title/file/line/message', async () => {
    const report = jsonReport([
      {
        title: 'login.spec.ts',
        file: 'e2e/login.spec.ts',
        line: 12,
        specs: [
          {
            title: 'should succeed',
            tests: [
              {
                status: 'unexpected',
                results: [
                  {
                    status: 'failed',
                    error: { message: 'Timeout waiting for selector' },
                    attachments: [
                      { name: 'trace', path: 'test-results/login/trace.zip' },
                      { name: 'screenshot', path: 'test-results/login/screenshot.png' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
    const exec = makeExecutor(async () => ({ stdout: report, stderr: '', exitCode: 1 }))

    const result = await exec.run()

    expect(result.status).toBe('failed')
    expect(result.summary).toEqual({ total: 1, passed: 0, failed: 1, skipped: 0 })
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toMatchObject({
      title: 'should succeed',
      file: 'e2e/login.spec.ts',
      line: 12,
      message: 'Timeout waiting for selector',
      artifacts: {
        trace: 'test-results/login/trace.zip',
        screenshot: 'test-results/login/screenshot.png',
      },
    })
  })

  it('skipped 测试计入 summary.skipped', async () => {
    const report = jsonReport([
      {
        title: 'a.spec.ts',
        file: 'e2e/a.spec.ts',
        specs: [
          {
            title: 'skipped one',
            tests: [{ status: 'skipped', results: [{ status: 'skipped' }] }],
          },
          {
            title: 'ok one',
            tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
          },
        ],
      },
    ])
    const exec = makeExecutor(async () => ({ stdout: report, stderr: '', exitCode: 0 }))

    const result = await exec.run()

    expect(result.summary).toEqual({ total: 2, passed: 1, failed: 0, skipped: 1 })
    expect(result.status).toBe('passed')
  })

  it('嵌套 suites 递归统计', async () => {
    const report = jsonReport([
      {
        title: 'outer',
        file: 'e2e/outer.spec.ts',
        specs: [
          {
            title: 'outer pass',
            tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
          },
        ],
        suites: [
          {
            title: 'inner',
            file: 'e2e/inner.spec.ts',
            line: 5,
            specs: [
              {
                title: 'inner fail',
                tests: [
                  {
                    status: 'unexpected',
                    results: [{ status: 'timedOut', error: { message: 'timed out' } }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
    const exec = makeExecutor(async () => ({ stdout: report, stderr: '', exitCode: 1 }))

    const result = await exec.run()

    expect(result.summary).toEqual({ total: 2, passed: 1, failed: 1, skipped: 0 })
    expect(result.failures[0]?.title).toBe('inner fail')
  })

  it('RunOptions 正确映射到 playwright test 参数', async () => {
    const seenArgs: string[][] = []
    const exec = makeExecutor(async (args) => {
      seenArgs.push(args)
      return { stdout: jsonReport([]), stderr: '', exitCode: 0 }
    })

    await exec.run({
      spec: 'e2e/login.spec.ts',
      browser: 'chromium',
      tag: '@login',
      headed: true,
      updateSnapshots: true,
      retries: 2,
    })

    expect(seenArgs[0]).toEqual([
      'e2e/login.spec.ts',
      '--project=chromium',
      '--grep',
      '@login',
      '--headed',
      '--update-snapshots',
      '--retries',
      '2',
      '--reporter=json',
    ])
  })

  it('从 config.json 读取默认 browser(未被 options 覆盖)', async () => {
    await storage.writeJson('.auto-e2e/config.json', { browser: 'firefox' })
    const seenArgs: string[][] = []
    const exec = makeExecutor(async (args) => {
      seenArgs.push(args)
      return { stdout: jsonReport([]), stderr: '', exitCode: 0 }
    })

    await exec.run()

    expect(seenArgs[0]).toContain('--project=firefox')
  })

  it('stdout 无 JSON → 归一化为 run_report_invalid 错误,status=failed', async () => {
    const exec = makeExecutor(async () => ({
      stdout: 'some random log',
      stderr: '',
      exitCode: 1,
    }))

    const result = await exec.run()

    expect(result.status).toBe('failed')
    expect(result.errors[0]?.code).toBe('run_report_invalid')
    expect(result.summary).toEqual({ total: 0, passed: 0, failed: 0, skipped: 0 })
  })

  it('stdout 前混有日志行 → 仍能提取并解析 JSON', async () => {
    const report = jsonReport(
      [
        {
          title: 'a.spec.ts',
          file: 'e2e/a.spec.ts',
          specs: [
            {
              title: 'pass',
              tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
            },
          ],
        },
      ],
      'Running tests...\n',
    )
    const exec = makeExecutor(async () => ({ stdout: report, stderr: '', exitCode: 0 }))

    const result = await exec.run()

    expect(result.summary.passed).toBe(1)
    expect(result.status).toBe('passed')
  })

  it('runPlaywright 抛错 → 归一化为 run_failed,recoverable=true', async () => {
    const exec = makeExecutor(async () => {
      throw new Error('spawn npx ENOENT')
    })

    const result = await exec.run()

    expect(result.status).toBe('failed')
    expect(result.errors[0]?.code).toBe('run_failed')
    expect(result.errors[0]?.recoverable).toBe(true)
    expect(result.errors[0]?.cause).toContain('ENOENT')
  })

  it('产物 attachments 被收集到顶层 artifacts', async () => {
    const report = jsonReport([
      {
        title: 'a.spec.ts',
        file: 'e2e/a.spec.ts',
        specs: [
          {
            title: 'fail',
            tests: [
              {
                status: 'unexpected',
                results: [
                  {
                    status: 'failed',
                    error: { message: 'x' },
                    attachments: [
                      { name: 'trace', path: 't.zip' },
                      { name: 'screenshot', path: 's.png', contentType: 'image/png' },
                      { name: 'video', path: 'v.webm' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
    const exec = makeExecutor(async () => ({ stdout: report, stderr: '', exitCode: 1 }))

    const result = await exec.run()

    expect(result.artifacts).toEqual([
      { path: 't.zip', kind: 'trace' },
      { path: 's.png', kind: 'screenshot' },
      { path: 'v.webm', kind: 'video' },
    ])
  })

  it('vi.fn 注入也可正常工作(验证可注入约定)', async () => {
    const fake = vi.fn(async (): Promise<PlaywrightRunOutput> => ({
      stdout: jsonReport([]),
      stderr: '',
      exitCode: 0,
    }))
    const exec = new PlaywrightExecutor({ projectRoot: root, storage, runPlaywright: fake })

    const result = await exec.run()

    expect(fake).toHaveBeenCalledTimes(1)
    expect(result.summary.total).toBe(0)
    expect(result.status).toBe('completed')
  })
})
