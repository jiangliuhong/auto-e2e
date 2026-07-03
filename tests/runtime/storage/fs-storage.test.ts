import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { FsStorageService } from '../../../src/runtime/storage/fs-storage.js'
import {
  agentContextPath,
  appMapPath,
  configPath,
  historyDir,
  observationsDir,
  reportsDir,
  runtimeDir,
} from '../../../src/runtime/storage/paths.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-storage-'))
})

afterEach(async () => {
  await fse.remove(root)
})

describe('FsStorageService', () => {
  it('ensureLayout 创建所有预期目录', async () => {
    const storage = new FsStorageService(root)
    await storage.ensureLayout()
    for (const dir of [
      runtimeDir(root),
      observationsDir(root),
      reportsDir(root),
      historyDir(root),
    ]) {
      expect(await fse.pathExists(dir)).toBe(true)
    }
  })

  it('resolve 将相对路径解析到 root', () => {
    const storage = new FsStorageService(root)
    expect(storage.resolve('.auto-e2e/config.json')).toBe(
      path.resolve(root, '.auto-e2e/config.json'),
    )
  })

  it('writeJson/readJson 以相对路径往返', async () => {
    const storage = new FsStorageService(root)
    await storage.ensureLayout()
    await storage.writeJson('.auto-e2e/config.json', { baseUrl: 'http://localhost:3000' })
    expect(await storage.readJson('.auto-e2e/config.json')).toEqual({
      baseUrl: 'http://localhost:3000',
    })
  })

  it('exists 检查相对路径存在性', async () => {
    const storage = new FsStorageService(root)
    await storage.ensureLayout()
    expect(await storage.exists('config.json')).toBe(false)
    expect(await storage.exists('.auto-e2e')).toBe(true)
  })

  it('paths 函数生成符合 OUTPUT_SPEC 的路径', () => {
    expect(configPath(root)).toBe(path.join(root, '.auto-e2e', 'config.json'))
    expect(appMapPath(root)).toBe(path.join(root, '.auto-e2e', 'app-map.json'))
    expect(agentContextPath(root)).toBe(path.join(root, '.auto-e2e', 'agent-context.md'))
  })

  it('ensureLayout 幂等(重复调用不报错)', async () => {
    const storage = new FsStorageService(root)
    await storage.ensureLayout()
    await storage.ensureLayout()
    expect(await fse.pathExists(runtimeDir(root))).toBe(true)
  })
})
