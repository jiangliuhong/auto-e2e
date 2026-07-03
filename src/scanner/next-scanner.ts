// Next.js ScannerProvider。
// detect: 命中 next 依赖或 next.config.* 即认为可处理。
// scan: 路由 + 脚本 + playwright。

import path from 'node:path'
import type { AppMap } from '../core/models.js'
import type { ScannerProvider } from './scanner-provider.js'
import { readPackageJson } from './package-manager.js'
import { detectPlaywright } from './playwright.js'
import { scanNextRoutes } from './route-scanner.js'

export class NextScannerProvider implements ScannerProvider {
  readonly name = 'nextjs'

  async detect(projectRoot: string): Promise<boolean> {
    const pkg = (await readPackageJson(projectRoot)) ?? {}
    const deps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    }
    if (deps.next) return true
    // next.config.* 存在
    const exts = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']
    for (const ext of exts) {
      const { pathExists } = await import('fs-extra')
      if (await pathExists(path.join(projectRoot, `next.config${ext}`))) return true
    }
    return false
  }

  async scan(projectRoot: string): Promise<Partial<AppMap>> {
    const pkg = (await readPackageJson(projectRoot)) ?? {}
    const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
    const srcDirs = await detectSrcDirs(projectRoot)
    const { routes, apiRoutes } = await scanNextRoutes(projectRoot, srcDirs)
    const playwright = await detectPlaywright(projectRoot)
    return {
      framework: 'nextjs',
      scripts,
      routes,
      apiRoutes,
      ...(playwright ? { playwright } : {}),
    }
  }
}

/** 检测源码根目录候选(优先 src,次选项目根)。 */
async function detectSrcDirs(projectRoot: string): Promise<string[]> {
  const fse = await import('fs-extra')
  const hasSrc = await fse.pathExists(path.join(projectRoot, 'src'))
  return hasSrc ? ['src', '.'] : ['.']
}
