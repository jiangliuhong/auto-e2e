// CompositeScanner:组合多个 ScannerProvider。
// 职责:
// 1. 按 provider 注册顺序,选首个 detect()=true 的 provider 做框架扫描。
// 2. 统一填充 packageManager(由包管理器检测模块提供,不归属单一框架 provider)。
// 3. 统一填充 selectorMap(data-testid 静态扫描)。
// 4. 无 provider 命中时,返回 unknown 框架 + 基础信息(不抛错)。
//
// 注意:本类只负责产出 ScanResult(含 AppMap + SelectorMap),不写文件;
// 文件写入由 DefaultRuntime.scan() 通过 Storage 完成。

import {
  type AppMap,
  type PackageManager,
  type ScanResult,
  type SelectorMap,
} from '../core/index.js'
import { detectPackageManager, readPackageJson } from './package-manager.js'
import { detectFramework } from './framework.js'
import { scanTestIds } from './testid-scanner.js'
import { toRuntimeError } from '../utils/errors.js'
import type { ScannerProvider } from './scanner-provider.js'

export interface CompositeScannerDeps {
  /** 候选 provider,按优先级排序。 */
  providers: ScannerProvider[]
}

export class CompositeScanner {
  private readonly providers: ScannerProvider[]

  constructor(deps: CompositeScannerDeps) {
    this.providers = deps.providers
  }

  /**
   * 扫描项目,返回结构化结果(含可能的 errors)。
   * 即便部分子扫描失败,也尽量返回已获取的信息。
   */
  async scan(projectRoot: string): Promise<ScanResult> {
    const errors: ScanResult['errors'] = []

    // 1) 选择首个命中的 provider
    let chosen: ScannerProvider | undefined
    for (const provider of this.providers) {
      try {
        if (await provider.detect(projectRoot)) {
          chosen = provider
          break
        }
      } catch {
        // detect 失败则尝试下一个
      }
    }

    // 2) 执行框架扫描(provider 或兜底)
    let partial: Partial<AppMap>
    if (chosen) {
      try {
        partial = await chosen.scan(projectRoot)
      } catch (err) {
        errors.push(wrapError(err, 'scan_provider_failed', { provider: chosen.name }))
        partial = await fallbackAppMap(projectRoot)
      }
    } else {
      partial = await fallbackAppMap(projectRoot)
    }

    // 3) 包管理器(统一填充)
    let packageManager: PackageManager = 'npm'
    try {
      packageManager = (await detectPackageManager(projectRoot)).manager
    } catch (err) {
      errors.push(wrapError(err, 'package_manager_detect_failed'))
    }

    // 4) 选择器扫描(testid)
    let selectorMap: SelectorMap = { items: [] }
    try {
      selectorMap = await scanTestIds(projectRoot)
    } catch (err) {
      errors.push(wrapError(err, 'testid_scan_failed'))
    }

    const appMap: AppMap = {
      framework: partial.framework ?? 'unknown',
      packageManager,
      scripts: partial.scripts ?? {},
      routes: partial.routes ?? [],
      apiRoutes: partial.apiRoutes ?? [],
      ...(partial.playwright ? { playwright: partial.playwright } : {}),
    }

    return {
      ok: errors.length === 0,
      appMap,
      selectorMap,
      errors,
    }
  }
}

/** 不依赖任何 provider 的兜底 AppMap 信息(脚本 + 框架检测)。 */
async function fallbackAppMap(projectRoot: string): Promise<Partial<AppMap>> {
  const pkg = (await readPackageJson(projectRoot)) ?? {}
  const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
  const { framework } = await detectFramework(projectRoot)
  return { framework, scripts, routes: [], apiRoutes: [] }
}

function wrapError(err: unknown, code: string, details?: Record<string, unknown>) {
  return toRuntimeError(err, { code, details })
}
