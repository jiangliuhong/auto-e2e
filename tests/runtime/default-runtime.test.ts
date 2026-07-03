import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { createRuntime } from '../../src/runtime/factory.js'
import { DefaultRuntime } from '../../src/runtime/default-runtime.js'
import { FsStorageService } from '../../src/runtime/storage/fs-storage.js'
import { LocalNodeEnvironmentProvider } from '../../src/runtime/environment/local-node-environment.js'
import {
  CompositeScanner,
  NextScannerProvider,
  ReactViteScannerProvider,
} from '../../src/scanner/index.js'
import type { Executor } from '../../src/runtime/executor/index.js'
import type { RunOptions, RunResult } from '../../src/core/index.js'
import {
  agentContextPath,
  appMapPath,
  codexContextPath,
  reportRunDir,
  runResultPath,
  selectorMapPath,
} from '../../src/runtime/storage/paths.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-rt-'))
})
afterEach(async () => {
  await fse.remove(root)
})

async function nextFixture() {
  await fse.writeJson(path.join(root, 'package.json'), {
    name: 'demo',
    packageManager: 'pnpm@9.0.0',
    dependencies: { next: '14.0.0' },
    scripts: { dev: 'next dev' },
  })
  await fse.outputFile(
    path.join(root, 'src/app/page.tsx'),
    'export default function Page(){return null}',
  )
  await fse.outputFile(
    path.join(root, 'src/app/login/page.tsx'),
    '<button data-testid="login-submit">x</button>',
  )
  await fse.outputFile(path.join(root, 'playwright.config.ts'), 'export default {}')
}

describe('DefaultRuntime.scan (集成)', () => {
  it('扫描并写入 app-map / selector-map / agent-context / codex-context', async () => {
    await nextFixture()
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.scan()

    expect(result.ok).toBe(true)
    expect(result.appMap.framework).toBe('nextjs')
    expect(result.contextPath).toBe(agentContextPath(root))

    // 文件落盘
    expect(await fse.pathExists(appMapPath(root))).toBe(true)
    expect(await fse.pathExists(selectorMapPath(root))).toBe(true)
    expect(await fse.pathExists(agentContextPath(root))).toBe(true)
    expect(await fse.pathExists(codexContextPath(root))).toBe(true)

    // app-map.json 内容正确
    const appMap = await fse.readJson(appMapPath(root))
    expect(appMap.framework).toBe('nextjs')
    expect(appMap.packageManager).toBe('pnpm')

    // agent-context 与 codex-context 内容相同(别名)
    const agentCtx = await fse.readFile(agentContextPath(root), 'utf8')
    const codexCtx = await fse.readFile(codexContextPath(root), 'utf8')
    expect(agentCtx).toBe(codexCtx)
    expect(agentCtx).toContain('nextjs')
  })
})

/** 构造一个返回固定 RunResult 的 fake Executor。 */
function fakeExecutor(result: Partial<RunResult>): Executor {
  return {
    async run(_options?: RunOptions): Promise<RunResult> {
      return {
        runId: 'run_001',
        status: 'passed',
        startedAt: '2026-01-01T00:00:00.000Z',
        endedAt: '2026-01-01T00:00:10.000Z',
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
        failures: [],
        errors: [],
        ...result,
      }
    },
  }
}

/** 用 fake executor 构造 DefaultRuntime(其余 provider 用真实默认实现,run 中不会调用)。 */
function runtimeWith(executor: Executor): DefaultRuntime {
  const storage = new FsStorageService(root)
  const environment = new LocalNodeEnvironmentProvider({ projectRoot: root, storage })
  const scanner = new CompositeScanner({
    providers: [new NextScannerProvider(), new ReactViteScannerProvider()],
  })
  return new DefaultRuntime({ projectRoot: root, storage, environment, scanner, executor })
}

describe('DefaultRuntime.observe/report (未实现)', () => {
  it('observe 返回 not_implemented 错误', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.observe({ url: '/login' })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.code).toBe('not_implemented')
    expect(result.errors[0]?.details).toEqual({ capability: 'observer' })
  })

  it('report 返回 not_implemented 错误', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.report()
    expect(result.errors[0]?.code).toBe('not_implemented')
    expect(result.ok).toBe(false)
  })
})

describe('DefaultRuntime.run (委托 executor + 写产物)', () => {
  it('把 options 透传给 executor,并返回其结果', async () => {
    const seen: RunOptions[] = []
    const executor: Executor = {
      async run(options?: RunOptions): Promise<RunResult> {
        if (options) seen.push(options)
        return fakeExecutor({ status: 'passed' }).run(options)
      },
    }
    const runtime = runtimeWith(executor)

    const result = await runtime.run({ spec: 'e2e/login.spec.ts', browser: 'chromium' })

    expect(seen[0]).toEqual({ spec: 'e2e/login.spec.ts', browser: 'chromium' })
    expect(result.status).toBe('passed')
    expect(result.runId).toBe('run_001')
  })

  it('写入顶层 run-result.json 快照', async () => {
    const runtime = runtimeWith(
      fakeExecutor({
        status: 'failed',
        summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
        failures: [
          {
            title: 'login should succeed',
            file: 'e2e/login.spec.ts',
            line: 12,
            message: 'Timeout',
          },
        ],
      }),
    )

    await runtime.run()

    expect(await fse.pathExists(runResultPath(root))).toBe(true)
    const snapshot = await fse.readJson(runResultPath(root))
    expect(snapshot.status).toBe('failed')
    expect(snapshot.runId).toBe('run_001')
    expect(snapshot.summary).toEqual({ total: 2, passed: 1, failed: 1, skipped: 0 })
    expect(snapshot.failures[0]?.title).toBe('login should succeed')
  })

  it('写入 reports/<runId>/run-result.json 归档', async () => {
    const runtime = runtimeWith(fakeExecutor({ runId: 'run_042', status: 'passed' }))

    await runtime.run()

    const archive = path.join(reportRunDir(root, 'run_042'), 'run-result.json')
    expect(await fse.pathExists(archive)).toBe(true)
    const archived = await fse.readJson(archive)
    expect(archived.runId).toBe('run_042')
  })
})
