// 包管理器检测。
// 权威来源优先级:package.json#packageManager > lock 文件存在性。
// 不执行任何命令,纯文件分析(对齐 ARCHITECTURE.md「Scanner 不依赖 Playwright / 不执行应用代码」)。

import path from 'node:path'
import fse from 'fs-extra'
import type { PackageManager } from '../core/models.js'

export interface PackageManagerDetection {
  manager: PackageManager
  /** 检测依据。 */
  source: 'packageManager-field' | 'lockfile' | 'fallback'
}

/**
 * 检测项目根目录使用的包管理器。
 */
export async function detectPackageManager(projectRoot: string): Promise<PackageManagerDetection> {
  // 1) package.json#packageManager 字段(权威)
  const pkg = await readPackageJson(projectRoot)
  const declared = pkg?.packageManager
  if (typeof declared === 'string') {
    const manager = parsePackageManagerField(declared)
    if (manager) {
      return { manager, source: 'packageManager-field' }
    }
  }

  // 2) lock 文件存在性
  if (await fse.pathExists(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    return { manager: 'pnpm', source: 'lockfile' }
  }
  if (await fse.pathExists(path.join(projectRoot, 'yarn.lock'))) {
    return { manager: 'yarn', source: 'lockfile' }
  }
  if (await fse.pathExists(path.join(projectRoot, 'package-lock.json'))) {
    return { manager: 'npm', source: 'lockfile' }
  }

  // 3) 兜底:默认 npm
  return { manager: 'npm', source: 'fallback' }
}

/** 读取并解析项目 package.json;不存在或非法时返回 undefined。 */
export async function readPackageJson(
  projectRoot: string,
): Promise<Record<string, unknown> | undefined> {
  const file = path.join(projectRoot, 'package.json')
  if (!(await fse.pathExists(file))) return undefined
  try {
    const raw = await fse.readFile(file, 'utf8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function parsePackageManagerField(value: string): PackageManager | undefined {
  // 形如 "pnpm@9.0.0" / "npm@10.2.3" / "yarn@4.1.0"
  const name = value.split('@')[0]
  if (name === 'pnpm' || name === 'npm' || name === 'yarn') return name
  return undefined
}
