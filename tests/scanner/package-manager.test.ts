import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { detectPackageManager } from '../../src/scanner/package-manager.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-pm-'))
})
afterEach(async () => {
  await fse.remove(root)
})

describe('detectPackageManager', () => {
  it('packageManager 字段优先(pnpm)', async () => {
    await fse.writeJson(path.join(root, 'package.json'), { packageManager: 'pnpm@9.0.0' })
    await fse.createFile(path.join(root, 'package-lock.json'))
    const r = await detectPackageManager(root)
    expect(r.manager).toBe('pnpm')
    expect(r.source).toBe('packageManager-field')
  })

  it('lock 文件检测:yarn.lock', async () => {
    await fse.writeJson(path.join(root, 'package.json'), {})
    await fse.createFile(path.join(root, 'yarn.lock'))
    const r = await detectPackageManager(root)
    expect(r.manager).toBe('yarn')
    expect(r.source).toBe('lockfile')
  })

  it('lock 文件检测:pnpm-lock.yaml', async () => {
    await fse.writeJson(path.join(root, 'package.json'), {})
    await fse.createFile(path.join(root, 'pnpm-lock.yaml'))
    const r = await detectPackageManager(root)
    expect(r.manager).toBe('pnpm')
    expect(r.source).toBe('lockfile')
  })

  it('lock 文件检测:package-lock.json', async () => {
    await fse.writeJson(path.join(root, 'package.json'), {})
    await fse.createFile(path.join(root, 'package-lock.json'))
    const r = await detectPackageManager(root)
    expect(r.manager).toBe('npm')
    expect(r.source).toBe('lockfile')
  })

  it('无任何线索时兜底 npm', async () => {
    await fse.writeJson(path.join(root, 'package.json'), {})
    const r = await detectPackageManager(root)
    expect(r.manager).toBe('npm')
    expect(r.source).toBe('fallback')
  })
})
