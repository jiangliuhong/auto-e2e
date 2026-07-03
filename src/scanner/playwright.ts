// Playwright 配置检测。
// 查找 playwright.config.{ts,js,mjs,cjs} 与默认 testDir。

import path from 'node:path'
import fse from 'fs-extra'
import type { PlaywrightInfo } from '../core/models.js'

const CONFIG_FILES = [
  'playwright.config.ts',
  'playwright.config.mts',
  'playwright.config.cts',
  'playwright.config.js',
  'playwright.config.mjs',
  'playwright.config.cjs',
]

/** 检测 Playwright 配置文件位置。 */
export async function detectPlaywright(projectRoot: string): Promise<PlaywrightInfo | undefined> {
  for (const f of CONFIG_FILES) {
    if (await fse.pathExists(path.join(projectRoot, f))) {
      return { configFile: f }
    }
  }
  return undefined
}
