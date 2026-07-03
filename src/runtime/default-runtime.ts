// DefaultRuntime:AutoE2ERuntime 的默认实现。
// 通过构造函数注入各 provider(storage / environment / scanner / executor),
// 对齐 AGENTS.md「优先依赖注入」「Provider 必须可替换」。
// observe/report 在本阶段(4/6)返回 notImplementedError,
// prepare/cleanup/scan/run/doctor 委托对应 provider。

import path from 'node:path'
import {
  notImplementedError,
  type AutoE2ERuntime,
  type RuntimeError,
  type CleanupOptions,
  type CleanupResult,
  type DoctorOptions,
  type DoctorResult,
  type ObserveOptions,
  type ObservationResult,
  type PrepareOptions,
  type PrepareResult,
  type ReportOptions,
  type ReportResult,
  type RunOptions,
  type RunResult,
  type ScanOptions,
  type ScanResult,
} from '../core/index.js'
import type { StorageService } from './storage/index.js'
import type { EnvironmentProvider } from './environment/index.js'
import type { CompositeScanner } from '../scanner/composite-scanner.js'
import { generateContextMarkdown } from '../scanner/context-generator.js'
import { agentContextPath, reportRunDir, runResultPath } from './storage/paths.js'
import { runDoctor } from './doctor.js'
import { toRuntimeError } from '../utils/errors.js'
import { writeJson } from '../utils/fs.js'
import type { Executor } from './executor/index.js'

export interface DefaultRuntimeDeps {
  projectRoot: string
  storage: StorageService
  environment: EnvironmentProvider
  scanner: CompositeScanner
  executor: Executor
}

export class DefaultRuntime implements AutoE2ERuntime {
  protected readonly deps: DefaultRuntimeDeps

  constructor(deps: DefaultRuntimeDeps) {
    this.deps = deps
  }

  async prepare(options?: PrepareOptions): Promise<PrepareResult> {
    await this.deps.storage.ensureLayout()
    return this.deps.environment.prepare(options)
  }

  async cleanup(options?: CleanupOptions): Promise<CleanupResult> {
    return this.deps.environment.cleanup(options)
  }

  async scan(options?: ScanOptions): Promise<ScanResult> {
    const root = options?.projectRoot ?? this.deps.projectRoot
    const generateCtx = options?.generateContext ?? true
    await this.deps.storage.ensureLayout()

    const result = await this.deps.scanner.scan(root)
    if (result.errors.length > 0 && result.appMap.framework === 'unknown') {
      // 扫描完全失败则直接返回
      return result
    }

    // 写入 app-map.json / selector-map.json(对齐 OUTPUT_SPEC.md)
    try {
      await this.deps.storage.writeJson('.auto-e2e/app-map.json', result.appMap)
      await this.deps.storage.writeJson('.auto-e2e/selector-map.json', result.selectorMap)

      if (generateCtx) {
        // 生成 agent-context.md(主)+ codex-context.md(向后兼容别名,内容相同)
        const markdown = generateContextMarkdown(result.appMap, result.selectorMap)
        await this.deps.storage.writeText('.auto-e2e/agent-context.md', markdown)
        await this.deps.storage.writeText('.auto-e2e/codex-context.md', markdown)
        return {
          ...result,
          contextPath: agentContextPath(root),
        }
      }
    } catch (err) {
      result.errors.push(toRuntimeError(err, { code: 'scan_write_failed' }))
    }

    return result
  }

  async observe(_options: ObserveOptions): Promise<ObservationResult> {
    return this.notImplemented<ObservationResult>('observer', (errors) => ({
      id: '',
      url: _options.url,
      finalUrl: '',
      title: '',
      elements: [],
      consoleMessages: [],
      networkRequests: [],
      recommendedSelectors: [],
      errors,
      createdAt: new Date().toISOString(),
    }))
  }

  async run(options?: RunOptions): Promise<RunResult> {
    await this.deps.storage.ensureLayout()

    const result = await this.deps.executor.run(options)

    // 写入 run-result.json:顶层快照(最近一次)+ reports/<runId>/ 归档。
    // 对齐 OUTPUT_SPEC.md「目录布局」与 scan() 的「runtime 层负责写文件」模式。
    // 用绝对路径 + paths 函数(writeJson 自动创建父目录,故无需逐 run ensureDir)。
    try {
      const snapshot = runResultPath(this.deps.projectRoot)
      await writeJson(snapshot, result)
      if (result.runId) {
        const archive = path.join(
          reportRunDir(this.deps.projectRoot, result.runId),
          'run-result.json',
        )
        await writeJson(archive, result)
      }
    } catch (err) {
      result.errors.push(toRuntimeError(err, { code: 'run_write_failed' }))
    }

    return result
  }

  async report(_options?: ReportOptions): Promise<ReportResult> {
    return this.notImplemented<ReportResult>('feedback', (errors) => ({ ok: false, errors }))
  }

  async doctor(options?: DoctorOptions): Promise<DoctorResult> {
    return runDoctor({ root: this.deps.projectRoot, ...options })
  }

  // --- 内部工具 ---

  /**
   * 统一生成 not_implemented 结果,把错误塞进 result.errors。
   */
  private async notImplemented<T>(
    capability: string,
    build: (errors: RuntimeError[]) => T,
  ): Promise<T> {
    const err = notImplementedError(capability)
    return build([err])
  }
}
