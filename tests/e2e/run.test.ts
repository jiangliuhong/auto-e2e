// 真实集成测试:通过 DefaultRuntime.run() 执行真实 Playwright 测试。
// 需要宿主环境已安装 @playwright/test 与浏览器;放在 tests/e2e/(被 vitest 默认排除),
// 用 `pnpm exec vitest run tests/e2e` 手动运行。未安装 Playwright 时整体跳过。

import { describe, expect, it, beforeAll, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { createRuntime } from '../../src/runtime/factory.js'
import { runResultPath } from '../../src/runtime/storage/paths.js'

const execAsync = promisify(exec)

let playwrightAvailable = false

beforeAll(async () => {
  try {
    await execAsync('npx --no-install playwright --version')
    playwrightAvailable = true
  } catch {
    playwrightAvailable = false
  }
})

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-e2e-run-'))
})

afterEach(async () => {
  await fse.remove(root)
})

/** 构造一个最小 Playwright 项目:含一个通过 spec 和一个失败 spec。
 * 通过符号链接复用本仓库的 node_modules(@playwright/test),避免每个 fixture 重新安装。 */
async function minimalProject() {
  const repoRoot = path.resolve(process.cwd())
  await fse.writeJson(path.join(root, 'package.json'), {
    name: 'e2e-fixture',
    version: '1.0.0',
    devDependencies: { '@playwright/test': '*' },
  })
  // 链接本仓库 node_modules,使 spec 能 import @playwright/test 并提供 .bin/playwright
  await fse.ensureSymlink(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'))
  await fse.writeFile(
    path.join(root, 'playwright.config.ts'),
    `import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  use: { browserName: 'chromium' },
  reporter: [['list']],
})`,
  )
  await fse.outputFile(
    path.join(root, 'e2e/pass.spec.ts'),
    `import { test, expect } from '@playwright/test'
test('always passes', () => { expect(1 + 1).toBe(2) })`,
  )
  await fse.outputFile(
    path.join(root, 'e2e/fail.spec.ts'),
    `import { test, expect } from '@playwright/test'
test('always fails', () => { expect(1 + 1).toBe(3) })`,
  )
}

describe('DefaultRuntime.run (真实 Playwright)', () => {
  it('执行测试并产出 run-result.json,status=failed', async () => {
    if (!playwrightAvailable) {
      console.warn('跳过:@playwright/test 不可用')
      return
    }
    await minimalProject()
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.run()

    // 一个通过 + 一个失败 → status=failed
    expect(result.status).toBe('failed')
    expect(result.summary.total).toBe(2)
    expect(result.summary.passed).toBe(1)
    expect(result.summary.failed).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]?.file).toContain('fail.spec.ts')

    // 顶层 run-result.json 快照写入
    expect(await fse.pathExists(runResultPath(root))).toBe(true)
    const snapshot = await fse.readJson(runResultPath(root))
    expect(snapshot.status).toBe('failed')
    expect(snapshot.runId).toBe(result.runId)

    // reports/<runId>/run-result.json 归档写入
    const archive = path.join(root, '.auto-e2e', 'reports', result.runId, 'run-result.json')
    expect(await fse.pathExists(archive)).toBe(true)
  }, 60000)

  it('run --spec 仅运行指定 spec', async () => {
    if (!playwrightAvailable) {
      console.warn('跳过:@playwright/test 不可用')
      return
    }
    await minimalProject()
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.run({ spec: path.join(root, 'e2e/pass.spec.ts') })

    // 仅跑 pass.spec.ts → 全通过
    expect(result.status).toBe('passed')
    expect(result.summary.total).toBe(1)
    expect(result.summary.passed).toBe(1)
    expect(result.summary.failed).toBe(0)
  }, 60000)
})
