// doctor 核心逻辑(属于 Runtime 层,不依赖 CLI)。
// 逐项检查项目是否能运行 auto-e2e,对齐 RUNTIME_SPEC.md「doctor()」。
// 检查项:Node 版本、包管理器、Playwright 安装、浏览器安装、config 有效性、
//         baseUrl 可达性(配置且未跳过时)、.auto-e2e/ 可写。

import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { detectPackageManager } from '../scanner/package-manager.js'
import { FsStorageService } from './storage/fs-storage.js'
import { configPath } from './storage/paths.js'
import { parseConfig } from './config.js'
import type { DoctorCheck, DoctorResult } from '../core/results.js'
import type { DoctorOptions } from '../core/options.js'

const execAsync = promisify(exec)

export interface DoctorRunOptions extends DoctorOptions {
  /** 项目根目录,默认 cwd。 */
  root?: string
}

/** 执行 doctor 的核心逻辑。 */
export async function runDoctor(opts: DoctorRunOptions = {}): Promise<DoctorResult> {
  const root = path.resolve(opts.root ?? process.cwd())
  const checks: DoctorCheck[] = []

  checks.push(await checkNodeVersion())
  checks.push(await checkPackageManager(root))
  checks.push(await checkPlaywrightInstalled(root))
  checks.push(await checkBrowsersInstalled())
  checks.push(await checkConfigValid(root))
  if (!opts.skipReachability) {
    checks.push(await checkBaseUrlReachable(root))
  }
  checks.push(await checkAutoE2eWritable(root))

  return { ok: checks.every((c) => c.ok), checks }
}

// --- 各项检查 ---

async function checkNodeVersion(): Promise<DoctorCheck> {
  const major = Number.parseInt(process.version.slice(1), 10)
  const ok = major >= 20
  return {
    name: 'node_version',
    ok,
    observed: process.version,
    expected: '>=20',
    message: ok ? undefined : 'Node 版本过低,auto-e2e 需要 Node >= 20。',
  }
}

async function checkPackageManager(root: string): Promise<DoctorCheck> {
  try {
    const detection = await detectPackageManager(root)
    return {
      name: 'package_manager',
      ok: true,
      observed: `${detection.manager} (via ${detection.source})`,
    }
  } catch {
    return { name: 'package_manager', ok: false, message: '无法检测包管理器。' }
  }
}

async function checkPlaywrightInstalled(root: string): Promise<DoctorCheck> {
  // 优先检查项目依赖中是否含 @playwright/test
  try {
    const pkgFile = path.join(root, 'package.json')
    if (await fse.pathExists(pkgFile)) {
      const pkg = JSON.parse(await fse.readFile(pkgFile, 'utf8')) as Record<string, unknown>
      const all = {
        ...(pkg.dependencies as Record<string, string> | undefined),
        ...(pkg.devDependencies as Record<string, string> | undefined),
      }
      if ('@playwright/test' in all) {
        return {
          name: 'playwright_installed',
          ok: true,
          observed: '@playwright/test (package.json)',
        }
      }
    }
  } catch {
    // 忽略,降级到命令检测
  }
  // 降级:通过 npx playwright --version
  try {
    const { stdout } = await execAsync('npx --no-install playwright --version', { cwd: root })
    return {
      name: 'playwright_installed',
      ok: true,
      observed: stdout.trim() || 'playwright (cli)',
    }
  } catch {
    return {
      name: 'playwright_installed',
      ok: false,
      message: '未检测到 @playwright/test。建议安装:npm i -D @playwright/test',
    }
  }
}

async function checkBrowsersInstalled(): Promise<DoctorCheck> {
  try {
    // --dry-run 不实际下载,仅检查是否需要安装
    const { stdout, stderr } = await execAsync('npx --no-install playwright install --dry-run')
    const out = `${stdout}\n${stderr}`.trim()
    // dry-run 输出中若提示需要下载,则视为未完整安装
    const needsInstall =
      /needs|download|install/i.test(out) && !/already|up to date|no browsers/i.test(out)
    return {
      name: 'browsers_installed',
      ok: !needsInstall,
      observed: needsInstall ? '部分浏览器需要安装' : '已安装(dry-run 通过)',
      message: needsInstall ? '运行 `npx playwright install` 安装浏览器。' : undefined,
    }
  } catch {
    // 命令失败通常意味着 playwright CLI 不可用,降级为未知(不阻断)
    return {
      name: 'browsers_installed',
      ok: true,
      observed: '未知(无法运行 playwright install --dry-run,跳过)',
    }
  }
}

async function checkConfigValid(root: string): Promise<DoctorCheck> {
  const file = configPath(root)
  if (!(await fse.pathExists(file))) {
    return {
      name: 'config_valid',
      ok: true,
      observed: '未找到 config.json(尚未 init,使用默认配置)',
    }
  }
  try {
    const raw = JSON.parse(await fse.readFile(file, 'utf8'))
    parseConfig(raw)
    return { name: 'config_valid', ok: true, observed: 'config.json 有效' }
  } catch (err) {
    return {
      name: 'config_valid',
      ok: false,
      message: `config.json 无效:${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function checkBaseUrlReachable(root: string): Promise<DoctorCheck> {
  let baseUrl: string | undefined
  try {
    const file = configPath(root)
    if (await fse.pathExists(file)) {
      const raw = JSON.parse(await fse.readFile(file, 'utf8'))
      baseUrl = parseConfig(raw).baseUrl
    }
  } catch {
    // config 无效时跳过可达性检查
  }
  if (!baseUrl) {
    return { name: 'base_url_reachable', ok: true, observed: '未配置 baseUrl,跳过' }
  }
  try {
    const res = await fetch(baseUrl, { method: 'GET', signal: AbortSignal.timeout(3000) })
    const ok = res.status < 500
    return {
      name: 'base_url_reachable',
      ok,
      observed: `${baseUrl} → HTTP ${res.status}`,
      message: ok ? undefined : `baseUrl 返回 ${res.status},dev server 可能未就绪。`,
    }
  } catch (err) {
    return {
      name: 'base_url_reachable',
      ok: false,
      observed: baseUrl,
      message: `无法连接 baseUrl:${err instanceof Error ? err.message : String(err)}(若 dev server 未启动属正常)`,
    }
  }
}

async function checkAutoE2eWritable(root: string): Promise<DoctorCheck> {
  const storage = new FsStorageService(root)
  try {
    await storage.ensureLayout()
    // 尝试写入探测文件再删除
    const probe = '.auto-e2e/.doctor-probe'
    await storage.writeText(probe, 'ok')
    await fse.remove(storage.resolve(probe))
    return { name: 'auto_e2e_writable', ok: true, observed: '.auto-e2e/ 可写' }
  } catch (err) {
    return {
      name: 'auto_e2e_writable',
      ok: false,
      message: `.auto-e2e/ 不可写:${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
