import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { runDoctor } from '../../../src/runtime/doctor.js'
import type { DoctorResult } from '../../../src/core/results.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-doctor-'))
})
afterEach(async () => {
  await fse.remove(root)
})

function findCheck(result: DoctorResult, name: string) {
  return result.checks.find((c) => c.name === name)
}

describe('runDoctor', () => {
  it('node_version 检查通过(运行环境 >= 20)', async () => {
    const result = await runDoctor({ root, skipReachability: true })
    const node = await findCheck(result, 'node_version')
    expect(node?.ok).toBe(true)
  })

  it('auto_e2e_writable 检查创建并探测 .auto-e2e/', async () => {
    const result = await runDoctor({ root, skipReachability: true })
    const writable = await findCheck(result, 'auto_e2e_writable')
    expect(writable?.ok).toBe(true)
    expect(await fse.pathExists(path.join(root, '.auto-e2e'))).toBe(true)
  })

  it('package_manager 检测', async () => {
    await fse.writeJson(path.join(root, 'package.json'), { packageManager: 'pnpm@9.0.0' })
    const result = await runDoctor({ root, skipReachability: true })
    const pm = await findCheck(result, 'package_manager')
    expect(pm?.ok).toBe(true)
    expect(pm?.observed).toContain('pnpm')
  })

  it('config_valid: 无 config.json 时通过', async () => {
    const result = await runDoctor({ root, skipReachability: true })
    const config = await findCheck(result, 'config_valid')
    expect(config?.ok).toBe(true)
  })

  it('config_valid: 非法 config 时失败', async () => {
    await fse.ensureDir(path.join(root, '.auto-e2e'))
    await fse.writeJson(path.join(root, '.auto-e2e/config.json'), { baseUrl: 'not-a-url' })
    const result = await runDoctor({ root, skipReachability: true })
    const config = await findCheck(result, 'config_valid')
    expect(config?.ok).toBe(false)
  })

  it('skipReachability 跳过 baseUrl 检查', async () => {
    const result = await runDoctor({ root, skipReachability: true })
    expect(result.checks.find((c) => c.name === 'base_url_reachable')).toBeUndefined()
  })

  it('result.ok = 所有检查通过', async () => {
    const result = await runDoctor({ root, skipReachability: true })
    // node/package_manager/playwright/browser/config/writable 各项可能因环境不同,
    // 但整体 ok 应等于所有 check.ok 为真。
    expect(result.ok).toBe(result.checks.every((c) => c.ok))
  })
})
