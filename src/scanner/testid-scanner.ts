// data-testid 静态扫描。
// 用 fast-glob 扫描源码文件,正则提取 data-testid="..." 值。
// 不执行应用代码。对齐 ARCHITECTURE.md「Scanner 不依赖 Playwright」。

import path from 'node:path'
import fse from 'fs-extra'
import fg from 'fast-glob'
import type { SelectorItem, SelectorMap } from '../core/models.js'

const TESTID_PATTERNS = [
  // data-testid="value" / data-testid='value' / data-testid={...} 仅取字面量
  /data-testid\s*=\s*"([^"]+)"/g,
  /data-testid\s*=\s*'([^']+)'/g,
]

/**
 * 扫描项目中的 data-testid,返回去重后的选择器列表。
 */
export async function scanTestIds(projectRoot: string): Promise<SelectorMap> {
  const files = await fg('**/*.{tsx,ts,jsx,js,vue,html,svelte}', {
    cwd: projectRoot,
    absolute: true,
    onlyFiles: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.auto-e2e/**',
    ],
  })

  const seen = new Set<string>()
  const items: SelectorItem[] = []

  for (const file of files.sort()) {
    const text = await fse.readFile(file, 'utf8').catch(() => '')
    if (!text) continue
    const source = path.relative(projectRoot, file).split(path.sep).join('/')
    for (const re of TESTID_PATTERNS) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        const value = m[1]
        if (value && !seen.has(value)) {
          seen.add(value)
          items.push({ source, kind: 'data-testid', value, confidence: 0.95 })
        }
      }
    }
  }

  // 按 value 排序,保证确定性。
  items.sort((a, b) => a.value.localeCompare(b.value))
  return { items }
}
