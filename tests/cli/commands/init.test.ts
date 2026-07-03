import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { runInit } from '../../../src/cli/commands/init.js'
import { configPath } from '../../../src/runtime/storage/paths.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-init-'))
})
afterEach(async () => {
  await fse.remove(root)
})

describe('runInit', () => {
  it('创建 .auto-e2e/ 目录与 config.json', async () => {
    const result = await runInit({ root })
    expect(result.ok).toBe(true)
    expect(result.created).toContain('.auto-e2e/')
    expect(await fse.pathExists(configPath(root))).toBe(true)
  })

  it('写入的 config.json 包含默认值', async () => {
    await runInit({ root })
    const config = await fse.readJson(configPath(root))
    expect(config.baseUrl).toBe('http://localhost:3000')
    expect(config.browser).toBe('chromium')
  })

  it('幂等:再次 init 不覆盖已有 config', async () => {
    await runInit({ root })
    // 手动改 config,再 init 不应覆盖
    await fse.writeJson(configPath(root), { baseUrl: 'http://custom:4000' })
    await runInit({ root })
    const config = await fse.readJson(configPath(root))
    expect(config.baseUrl).toBe('http://custom:4000')
  })

  it('--force 覆盖已有 config', async () => {
    await runInit({ root })
    await fse.writeJson(configPath(root), { baseUrl: 'http://custom:4000' })
    await runInit({ root, force: true })
    const config = await fse.readJson(configPath(root))
    expect(config.baseUrl).toBe('http://localhost:3000')
  })

  it('config 路径正确指向 root 下', async () => {
    const result = await runInit({ root })
    expect(result.configPath).toBe(configPath(root))
    expect(result.configPath).toBe(path.join(root, '.auto-e2e', 'config.json'))
  })
})
