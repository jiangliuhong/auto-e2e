// PlaywrightExecutor:Executor 的默认实现。
// 职责:
// - run():通过子进程调用 Playwright(优先项目本地 bin,fallback 到 npx),
//   以 --reporter=json 解析 JSON 报告,返回结构化 RunResult。
//
// 设计要点(对齐 ARCHITECTURE.md「业务逻辑不得直接依赖 Playwright」):
// - 不 import @playwright/test(它是 optional peerDep);沿用 doctor.ts 的
//   子进程调用先例,优先用项目本地 node_modules/.bin/playwright。
// - 通过构造函数注入 `runPlaywright` 回调,便于测试替换,避免真实启动 Playwright。
// - 所有异常用 toRuntimeError() 归一化后塞进 RunResult.errors,不抛裸异常
//   (对齐 RUNTIME_SPEC.md「避免从 provider 中抛出原始错误」)。

import path from 'node:path'
import { execa } from 'execa'
import fse from 'fs-extra'
import { type Executor } from './index.js'
import type { StorageService } from '../storage/storage.js'
import { createRunId } from '../../utils/id.js'
import { toRuntimeError } from '../../utils/errors.js'
import type {
  ArtifactRef,
  RunFailure,
  RunOptions,
  RunResult,
  RunSummary,
} from '../../core/index.js'

/**
 * 解析 Playwright 可执行命令。
 * 优先用项目本地 node_modules/.bin/playwright(对齐 doctor 检测 @playwright/test 的思路,
 * 避免依赖全局/网络);不存在则 fallback 到 `npx playwright`(允许 npx 解析/下载)。
 */
async function resolvePlaywrightBin(cwd: string): Promise<{ command: string; prefix: string[] }> {
  const localBin = path.join(cwd, 'node_modules', '.bin', 'playwright')
  if (await fse.pathExists(localBin)) {
    return { command: localBin, prefix: ['test'] }
  }
  return { command: 'npx', prefix: ['playwright', 'test'] }
}

/** 默认的 Playwright 子进程执行函数。 */
async function runPlaywrightViaNpx(args: string[], cwd: string): Promise<PlaywrightRunOutput> {
  const { command, prefix } = await resolvePlaywrightBin(cwd)
  const result = await execa(command, [...prefix, ...args], {
    cwd,
    reject: false,
    // Playwright 即使测试失败也会以退出码 1 返回,此时 stdout 仍是有效的 JSON 报告。
    // 故用 reject:false 让 execa 不抛错,统一由解析逻辑处理。
  })
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode ?? -1 }
}

/** Playwright 子进程调用的返回结构。 */
export interface PlaywrightRunOutput {
  stdout: string
  stderr: string
  exitCode: number
}

export interface PlaywrightExecutorOptions {
  projectRoot: string
  storage: StorageService
  /** 可注入的 Playwright 执行函数(测试用);默认走 execa 调用 npx。 */
  runPlaywright?: (args: string[], cwd: string) => Promise<PlaywrightRunOutput>
}

export class PlaywrightExecutor implements Executor {
  private readonly projectRoot: string
  private readonly storage: StorageService
  private readonly runPlaywright: (args: string[], cwd: string) => Promise<PlaywrightRunOutput>

  constructor(opts: PlaywrightExecutorOptions) {
    this.projectRoot = opts.projectRoot
    this.storage = opts.storage
    this.runPlaywright = opts.runPlaywright ?? runPlaywrightViaNpx
  }

  async run(options?: RunOptions): Promise<RunResult> {
    const startedAt = new Date().toISOString()
    const errors: RunResult['errors'] = []

    try {
      // 1) 解析 config 取默认 browser(被 options 覆盖)
      const config =
        (await this.storage.readJson<{ browser?: RunOptions['browser'] }>(
          '.auto-e2e/config.json',
        )) ?? {}
      const browser = options?.browser ?? config.browser

      // 2) 拼装 CLI 参数
      const args = buildArgs({ ...options, browser })

      // 3) 执行 Playwright
      const output = await this.runPlaywright(args, this.projectRoot)

      // 4) 解析 JSON 报告
      const report = parseReport(output)
      if ('parseError' in report) {
        errors.push(
          toRuntimeError(report.parseError, {
            code: 'run_report_invalid',
            recoverable: false,
            details: { exitCode: output.exitCode, stderr: output.stderr.slice(0, 2000) },
          }),
        )
      }

      const summary = 'parseError' in report ? emptySummary() : report.summary
      const failures = 'parseError' in report ? [] : report.failures
      const artifacts = 'parseError' in report ? undefined : report.artifacts

      return {
        runId: createRunId(),
        status: resolveStatus(summary, errors),
        startedAt,
        endedAt: new Date().toISOString(),
        summary,
        failures,
        ...(artifacts && artifacts.length > 0 ? { artifacts } : {}),
        errors,
      }
    } catch (err) {
      errors.push(toRuntimeError(err, { code: 'run_failed', recoverable: true }))
      return {
        runId: createRunId(),
        status: 'failed',
        startedAt,
        endedAt: new Date().toISOString(),
        summary: emptySummary(),
        failures: [],
        errors,
      }
    }
  }
}

// --- 参数拼装 ---

/** 把 RunOptions 映射为 `playwright test` 的 CLI 参数。 */
function buildArgs(options: {
  spec?: string
  suite?: string
  tag?: string
  headed?: boolean
  browser?: RunOptions['browser']
  updateSnapshots?: boolean
  retries?: number
}): string[] {
  const args: string[] = []
  if (options.spec) args.push(options.spec)
  if (options.browser) args.push(`--project=${options.browser}`)
  if (options.tag) args.push('--grep', options.tag)
  if (options.headed) args.push('--headed')
  if (options.updateSnapshots) args.push('--update-snapshots')
  if (typeof options.retries === 'number') args.push('--retries', String(options.retries))
  // 固定使用 JSON reporter 以便解析。suite 暂无直接 CLI 映射,留待后续扩展。
  args.push('--reporter=json')
  void options.suite
  return args
}

// --- JSON 报告解析 ---

/** Playwright JSON reporter 的(部分)结构,仅取解析所需字段。 */
interface PlaywrightReport {
  suites: PlaywrightSuite[]
}
interface PlaywrightSuite {
  title: string
  file?: string
  column?: number
  line?: number
  specs: PlaywrightSpec[]
  suites?: PlaywrightSuite[]
}
interface PlaywrightSpec {
  title: string
  ok?: boolean
  tests: PlaywrightTest[]
}
interface PlaywrightTest {
  results: PlaywrightTestResult[]
  status?: 'expected' | 'unexpected' | 'flaky' | 'skipped'
}
interface PlaywrightTestResult {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
  attachments?: { name: string; path?: string; contentType?: string }[]
  error?: { message?: string } & Record<string, unknown>
}

type ParseOutcome =
  | { summary: RunSummary; failures: RunFailure[]; artifacts: ArtifactRef[] }
  | { parseError: unknown }

/** 解析 Playwright 子进程输出为 RunResult 的 summary/failures/artifacts。 */
function parseReport(output: PlaywrightRunOutput): ParseOutcome {
  const json = extractJson(output.stdout)
  if (json === undefined) {
    return {
      parseError: new Error('无法从 Playwright 输出中提取 JSON 报告'),
    }
  }

  let report: PlaywrightReport
  try {
    report = JSON.parse(json) as PlaywrightReport
  } catch (err) {
    return { parseError: err }
  }

  let total = 0
  let passed = 0
  let failed = 0
  let skipped = 0
  const failures: RunFailure[] = []
  const artifacts: ArtifactRef[] = []

  const visitSuite = (suite: PlaywrightSuite): void => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        total += 1
        const outcome = classifyTest(test)
        if (outcome === 'passed') passed += 1
        else if (outcome === 'failed') {
          failed += 1
          failures.push(toFailure(suite, spec, test))
          collectArtifacts(test, artifacts)
        } else if (outcome === 'skipped') skipped += 1
        // 其余情况归入 total 但不增 passed/failed/skipped
      }
    }
    for (const child of suite.suites ?? []) visitSuite(child)
  }
  for (const suite of report.suites ?? []) visitSuite(suite)

  return {
    summary: { total, passed, failed, skipped },
    failures,
    artifacts,
  }
}

/** 判定单个 test 的最终状态。 */
function classifyTest(test: PlaywrightTest): 'passed' | 'failed' | 'skipped' | 'other' {
  if (test.status === 'skipped') return 'skipped'
  // 无 results 视为未运行
  if (!test.results || test.results.length === 0) return 'other'
  const last = test.results[test.results.length - 1]
  if (!last) return 'other'
  if (last.status === 'passed') {
    // status === 'flaky' 表示至少重试后通过,视为 passed
    return 'passed'
  }
  if (last.status === 'failed' || last.status === 'timedOut' || last.status === 'interrupted') {
    return 'failed'
  }
  if (last.status === 'skipped') return 'skipped'
  return 'other'
}

/** 把一个失败 test 转为 RunFailure。 */
function toFailure(suite: PlaywrightSuite, spec: PlaywrightSpec, test: PlaywrightTest): RunFailure {
  const last = test.results?.[test.results.length - 1]
  const message = last?.error?.message ?? 'Playwright 测试失败(无错误信息)'
  const trace = findAttachment(last, ['trace', 'trace.zip'])
  const screenshot = findAttachment(last, ['screenshot', 'test-failed-1.png'])
  return {
    title: spec.title || suite.title || '(未命名测试)',
    file: suite.file ?? '',
    ...(suite.line !== undefined ? { line: suite.line } : {}),
    message,
    ...((trace || screenshot) && {
      artifacts: {
        ...(trace ? { trace } : {}),
        ...(screenshot ? { screenshot } : {}),
      },
    }),
  }
}

/** 从 test 的 attachments 中提取 trace/截图等产物,追加到 artifacts。 */
function collectArtifacts(test: PlaywrightTest, artifacts: ArtifactRef[]): void {
  const last = test.results?.[test.results.length - 1]
  for (const att of last?.attachments ?? []) {
    if (!att.path) continue
    const kind = attachmentKind(att.name, att.contentType)
    if (kind) artifacts.push({ path: att.path, kind })
  }
}

/** 根据 attachment 名/类型推断 ArtifactRef.kind。 */
function attachmentKind(name: string, contentType?: string): string | undefined {
  if (name === 'trace' || name === 'trace.zip') return 'trace'
  if (name.includes('screenshot') || (contentType ?? '').startsWith('image/')) return 'screenshot'
  if (name === 'video') return 'video'
  return undefined
}

/** 在 attachments 中按候选名查找第一个产物路径。 */
function findAttachment(
  result: PlaywrightTestResult | undefined,
  names: string[],
): string | undefined {
  for (const n of names) {
    const hit = result?.attachments?.find((a) => a.name === n && a.path)
    if (hit?.path) return hit.path
  }
  return undefined
}

/**
 * 从 Playwright stdout 提取 JSON 报告。
 * JSON reporter 通常把整个 JSON 打到 stdout,但偶尔会混入前导日志行;
 * 取第一个 `{` 到匹配的最后一个 `}` 之间的内容。
 */
function extractJson(stdout: string): string | undefined {
  if (!stdout) return undefined
  const start = stdout.indexOf('{')
  if (start === -1) return undefined
  const end = stdout.lastIndexOf('}')
  if (end === -1 || end < start) return undefined
  return stdout.slice(start, end + 1)
}

function emptySummary(): RunSummary {
  return { total: 0, passed: 0, failed: 0, skipped: 0 }
}

/** 由 summary 与 errors 推导 RunResult.status。 */
function resolveStatus(summary: RunSummary, errors: RunResult['errors']): RunResult['status'] {
  if (errors.length > 0 && summary.total === 0) return 'failed'
  if (summary.failed > 0) return 'failed'
  if (summary.total === 0) return 'completed'
  return 'passed'
}
