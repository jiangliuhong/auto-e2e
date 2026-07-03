import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { LocalNodeEnvironmentProvider } from '../../../src/runtime/environment/local-node-environment.js'
import { FsStorageService } from '../../../src/runtime/storage/fs-storage.js'
import { storageStatePath } from '../../../src/runtime/storage/paths.js'

// 使用一个不太可能冲突的端口;通过 PORT 环境变量传给 mini-server。
const PORT = 4399
const BASE_URL = `http://127.0.0.1:${PORT}`
const miniServerPath = path.resolve(process.cwd(), 'tests/fixtures/mini-server.js')

let root: string
let provider: LocalNodeEnvironmentProvider

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-env-'))
  const storage = new FsStorageService(root)
  await storage.ensureLayout()
  // 写一个最小 config,baseUrl 指向 mini-server
  await storage.writeJson('.auto-e2e/config.json', { baseUrl: BASE_URL })
  provider = new LocalNodeEnvironmentProvider({ projectRoot: root, storage })
})

afterEach(async () => {
  // 确保清理子进程,避免泄漏
  await provider.cleanup()
  await fse.remove(root)
})

describe('LocalNodeEnvironmentProvider', () => {
  it('prepare 启动 dev server 并等待就绪,写入 storageState', async () => {
    // 通过显式 devCommand 启动 mini-server,设 PORT 环境变量
    process.env.PORT = String(PORT)
    const result = await provider.prepare({
      devCommand: `node ${miniServerPath}`,
      readyTimeoutMs: 8000,
    })

    expect(result.ok).toBe(true)
    expect(result.devServerStarted).toBe(true)
    expect(result.baseUrl).toBe(BASE_URL)
    expect(result.pid).toBeGreaterThan(0)
    expect(result.storageStatePath).toBe(storageStatePath(root))

    // storageState 占位文件应存在
    expect(await fse.pathExists(storageStatePath(root))).toBe(true)

    // healthCheck 应成功
    const health = await provider.healthCheck(BASE_URL)
    expect(health.ok).toBe(true)
    expect(health.status).toBe(200)
  }, 15000)

  it('cleanup 停止 dev server', async () => {
    process.env.PORT = String(PORT)
    await provider.prepare({ devCommand: `node ${miniServerPath}`, readyTimeoutMs: 8000 })

    const cleanup = await provider.cleanup()
    expect(cleanup.ok).toBe(true)
    expect(cleanup.devServerStopped).toBe(true)

    // 停止后 healthCheck 应失败
    const health = await provider.healthCheck(BASE_URL)
    expect(health.ok).toBe(false)
  }, 15000)

  it('cleanup 幂等(未启动时直接清理)', async () => {
    const cleanup = await provider.cleanup()
    expect(cleanup.ok).toBe(true)
    expect(cleanup.devServerStopped).toBe(true)
  })

  it('prepare 在 startDevServer=false 时不启动进程', async () => {
    const result = await provider.prepare({ startDevServer: false })
    expect(result.ok).toBe(true)
    expect(result.devServerStarted).toBe(false)
    expect(result.pid).toBeUndefined()
    // storageState 仍应被创建
    expect(await fse.pathExists(storageStatePath(root))).toBe(true)
  })
})
