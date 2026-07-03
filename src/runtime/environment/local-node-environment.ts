// LocalNodeEnvironmentProvider:本地 Node 环境实现。
// 职责:
// - prepare():按包管理器启动 dev server(detached),等待 baseUrl 就绪,
//   写入 storageState 占位。幂等(已运行则复用)。
// - cleanup():终止受管 dev server(SIGTERM → SIGKILL 兜底)。不删 .auto-e2e/。
// - healthCheck():探测 baseUrl。
//
// 通过构造函数注入 storage / config / packageManager 检测函数,便于测试与替换。

import { type ChildProcess, spawn } from 'node:child_process'
import { type EnvironmentProvider } from './environment-provider.js'
import type { HealthCheckResult } from './health-check.js'
import { probeOnce, waitForReady } from './readiness.js'
import { detectPackageManager } from '../../scanner/package-manager.js'
import { devServerPidPath, storageStatePath } from '../storage/paths.js'
import type { StorageService } from '../storage/storage.js'
import type {
  CleanupOptions,
  CleanupResult,
  PrepareOptions,
  PrepareResult,
} from '../../core/index.js'
import { toRuntimeError } from '../../utils/errors.js'

export interface LocalNodeEnvironmentOptions {
  projectRoot: string
  storage: StorageService
}

export class LocalNodeEnvironmentProvider implements EnvironmentProvider {
  private readonly projectRoot: string
  private readonly storage: StorageService
  /** 受管的 dev server 子进程(若存在)。 */
  private child: ChildProcess | undefined

  constructor(opts: LocalNodeEnvironmentOptions) {
    this.projectRoot = opts.projectRoot
    this.storage = opts.storage
  }

  async prepare(options?: PrepareOptions): Promise<PrepareResult> {
    const errors: PrepareResult['errors'] = []
    await this.storage.ensureLayout()

    // 1) 解析 config(baseUrl / devCommand)
    const config =
      (await this.storage.readJson<Record<string, unknown>>('.auto-e2e/config.json')) ?? {}
    const baseUrl = options?.baseUrl ?? asString(config.baseUrl) ?? 'http://localhost:3000'
    const startDevServer = options?.startDevServer ?? true

    let devServerStarted = false
    let pid: number | undefined

    // 2) 启动 dev server(若已运行则复用)
    if (startDevServer) {
      if (this.child && !this.child.killed) {
        devServerStarted = true
        pid = this.child.pid
      } else {
        try {
          const cmd = await this.resolveDevCommand(
            options?.devCommand ?? asString(config.devCommand),
          )
          this.child = await this.startDev(cmd.command, cmd.args)
          pid = this.child.pid
          devServerStarted = true
          // 持久化 PID,便于跨 CLI 调用(进程退出后)清理 detached server
          if (pid !== undefined) {
            await this.storage.writeText('.auto-e2e/dev-server.pid', String(pid))
          }
        } catch (err) {
          errors.push(toRuntimeError(err, { code: 'dev_server_start_failed', recoverable: true }))
          return { ok: false, baseUrl, devServerStarted, errors }
        }
      }

      // 3) 等待就绪
      const ready = await waitForReady(baseUrl, {
        timeoutMs: options?.readyTimeoutMs ?? 30_000,
      })
      if (!ready.ok) {
        if (ready.error) errors.push(ready.error)
        return { ok: false, baseUrl, devServerStarted, pid, errors }
      }
    }

    // 4) storageState 占位
    const storageStateRel = '.auto-e2e/storage-state.json'
    if (!(await this.storage.exists(storageStateRel))) {
      await this.storage.writeJson(storageStateRel, {})
    }

    return {
      ok: errors.length === 0,
      baseUrl,
      devServerStarted,
      ...(pid !== undefined ? { pid } : {}),
      storageStatePath: storageStatePath(this.projectRoot),
      errors,
    }
  }

  async cleanup(options?: CleanupOptions): Promise<CleanupResult> {
    const errors: CleanupResult['errors'] = []
    let devServerStopped = false

    // 优先用当前进程持有的 child 引用(同进程内 prepare → cleanup)
    if (this.child) {
      try {
        devServerStopped = await this.stopChild(this.child)
        this.child = undefined
      } catch (err) {
        errors.push(toRuntimeError(err, { code: 'dev_server_stop_failed' }))
      }
    } else {
      // 跨 CLI 调用:读 PID 文件,按 PID 终止 detached 进程组
      const stopped = await this.stopDetachedByPidFile()
      devServerStopped = stopped
    }

    // 无论是否成功,清理 PID 文件(进程已不存在则文件失效)
    try {
      if (await this.storage.exists('.auto-e2e/dev-server.pid')) {
        await this.storage.writeText('.auto-e2e/dev-server.pid', '')
      }
    } catch {
      // 忽略 PID 文件清理错误
    }

    // 注意:cleanup 不删 .auto-e2e/ 历史(对齐 RUNTIME_SPEC.md「除非显式要求,
    // 不得删除 .auto-e2e/ 历史」)。
    void options?.purgeHistory

    return { ok: errors.length === 0, devServerStopped, errors }
  }

  async healthCheck(baseUrl?: string): Promise<HealthCheckResult> {
    const url = baseUrl ?? 'http://localhost:3000'
    return probeOnce(url)
  }

  // --- 内部 ---

  /** 解析 dev 启动命令:优先显式传入,其次 config,最后按包管理器推导。 */
  private async resolveDevCommand(explicit?: string): Promise<{ command: string; args: string[] }> {
    if (explicit) {
      return parseShellCommand(explicit)
    }
    const manager = (await detectPackageManager(this.projectRoot)).manager
    // pnpm/npm/yarn 均支持 `run dev`
    return { command: manager, args: ['run', 'dev'] }
  }

  /**
   * 启动 dev server,detached 以便作为后台进程组管理。
   * stdio 设为 ignore:就绪与否由 waitForReady 探针判断,无需捕获子进程输出,
   * 同时避免父进程因未读取的管道句柄而无法退出(支持 CLI「启动后退出」语义)。
   */
  private startDev(command: string, args: string[]): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: this.projectRoot,
        stdio: 'ignore',
        detached: true,
        shell: process.platform === 'win32',
      })
      child.once('error', (err) => reject(err))
      // 允许父进程独立退出;detached 子进程仍按进程组管理,可被 cleanup 信号终止。
      child.unref()
      // 立即 resolve;就绪由 waitForReady 负责
      resolve(child)
    })
  }

  /** 优雅停止子进程:SIGTERM → 等待 → SIGKILL。 */
  private stopChild(child: ChildProcess): Promise<boolean> {
    return new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode) {
        resolve(true)
        return
      }
      let settled = false
      const onFinish = () => {
        if (settled) return
        settled = true
        resolve(true)
      }
      child.once('exit', onFinish)

      // 尝试终止整个进程组(detached 时 child 是组长)
      try {
        if (child.pid && child.pid > 0) {
          process.kill(-child.pid, 'SIGTERM')
        } else {
          child.kill('SIGTERM')
        }
      } catch {
        child.kill('SIGTERM')
      }

      // 5s 后强制 kill
      setTimeout(() => {
        if (!settled) {
          try {
            if (child.pid && child.pid > 0) {
              process.kill(-child.pid, 'SIGKILL')
            } else {
              child.kill('SIGKILL')
            }
          } catch {
            // 忽略:可能已退出
          }
          onFinish()
        }
      }, 5000)
    })
  }

  /**
   * 跨进程清理:读取 PID 文件并按进程组终止 detached dev server。
   * 用于 CLI 场景下,prepare(进程 A)启动 server 后退出,cleanup(进程 B)再清理。
   * 返回 true 表示已停止或本就没有运行。
   */
  private async stopDetachedByPidFile(): Promise<boolean> {
    const pidText = await this.storage.readText('.auto-e2e/dev-server.pid')
    const pid = Number.parseInt((pidText ?? '').trim(), 10)
    if (!Number.isInteger(pid) || pid <= 0) {
      // 无 PID 记录,视为无可清理的 server
      return true
    }
    try {
      // 先 SIGTERM 整个进程组(detached server 是组长),再 SIGKILL 兜底
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // 进程可能已不存在
        return true
      }
    }
    // 给一点时间优雅退出,然后确保终止
    await new Promise((r) => setTimeout(r, 500))
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        // 已退出
      }
    }
    return true
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** 把用户提供的命令字符串拆分为 command + args(简单分词)。 */
function parseShellCommand(input: string): { command: string; args: string[] } {
  const parts = input.trim().split(/\s+/)
  const command = parts[0] ?? input
  const args = parts.slice(1)
  return { command, args }
}
