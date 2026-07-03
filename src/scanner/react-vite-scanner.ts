// React + Vite ScannerProvider。
// detect: vite + react(或 @vitejs/plugin-react)。
// scan: 脚本 + playwright(React+Vite 通常无约定式路由,路由留空)。

import type { AppMap } from '../core/models.js'
import type { ScannerProvider } from './scanner-provider.js'
import { readPackageJson } from './package-manager.js'
import { detectPlaywright } from './playwright.js'

export class ReactViteScannerProvider implements ScannerProvider {
  readonly name = 'react-vite'

  async detect(projectRoot: string): Promise<boolean> {
    const pkg = (await readPackageJson(projectRoot)) ?? {}
    const deps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    }
    const hasVite = Boolean(deps.vite)
    const hasReact = Boolean(deps.react) || Boolean(deps['react-dom'])
    const hasReactPlugin =
      Boolean(deps['@vitejs/plugin-react']) || Boolean(deps['@vitejs/plugin-react-swc'])
    return (hasVite && (hasReact || hasReactPlugin)) || hasReact
  }

  async scan(projectRoot: string): Promise<Partial<AppMap>> {
    const pkg = (await readPackageJson(projectRoot)) ?? {}
    const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
    const playwright = await detectPlaywright(projectRoot)
    return {
      framework: 'react-vite',
      scripts,
      routes: [],
      apiRoutes: [],
      ...(playwright ? { playwright } : {}),
    }
  }
}
