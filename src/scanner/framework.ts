// 框架检测。
// 综合 package.json 依赖与目录/配置文件特征判定框架。
// 纯文件分析,不执行应用代码。

import path from 'node:path'
import fse from 'fs-extra'
import type { Framework } from '../core/models.js'
import { readPackageJson } from './package-manager.js'

export interface FrameworkDetection {
  framework: Framework
  /** 检测命中的依据。 */
  hints: string[]
}

/**
 * 检测项目使用的框架。
 * 优先级:Next.js > React+Vite > Vue+Vite > unknown。
 */
export async function detectFramework(projectRoot: string): Promise<FrameworkDetection> {
  const pkg = (await readPackageJson(projectRoot)) ?? {}
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  }
  const hints: string[] = []

  // Next.js:依赖 next,或存在 next.config.*
  if (deps.next) hints.push('package.json: next')
  if (await hasConfigFile(projectRoot, 'next.config')) hints.push('next.config.*')
  if (hints.length > 0) return { framework: 'nextjs', hints }

  // Vite 基础
  const hasVite = Boolean(deps.vite) || (await hasConfigFile(projectRoot, 'vite.config'))
  const hasReactPlugin =
    Boolean(deps['@vitejs/plugin-react']) || Boolean(deps['@vitejs/plugin-react-swc'])
  const hasVuePlugin = Boolean(deps['@vitejs/plugin-vue'])

  // React + Vite
  const hasReact = Boolean(deps.react) || Boolean(deps['react-dom'])
  if ((hasVite && (hasReact || hasReactPlugin)) || hasReact) {
    if (hasVite) hints.push('vite + react')
    else hints.push('react')
    return { framework: 'react-vite', hints }
  }

  // Vue + Vite
  const hasVue = Boolean(deps.vue)
  if ((hasVite && (hasVue || hasVuePlugin)) || hasVue) {
    hints.push('vite + vue')
    return { framework: 'vue-vite', hints }
  }

  return { framework: 'unknown', hints }
}

/** 判断是否存在任意后缀匹配的配置文件(如 next.config.ts/.js/.mjs/.cjs)。 */
async function hasConfigFile(projectRoot: string, base: string): Promise<boolean> {
  const exts = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json']
  for (const ext of exts) {
    if (await fse.pathExists(path.join(projectRoot, `${base}${ext}`))) return true
  }
  return false
}
