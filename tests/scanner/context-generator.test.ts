import { describe, expect, it } from 'vitest'
import { generateContextMarkdown } from '../../src/scanner/context-generator.js'
import type { AppMap, SelectorMap } from '../../src/core/models.js'

function baseAppMap(over: Partial<AppMap> = {}): AppMap {
  return {
    framework: 'nextjs',
    packageManager: 'pnpm',
    scripts: { dev: 'next dev', build: 'next build' },
    routes: [{ path: '/login', source: 'src/app/login/page.tsx' }],
    apiRoutes: [],
    ...over,
  }
}

describe('generateContextMarkdown', () => {
  it('包含标题与基本信息', () => {
    const md = generateContextMarkdown(baseAppMap(), { items: [] })
    expect(md).toContain('# auto-e2e 项目上下文')
    expect(md).toContain('框架:nextjs')
    expect(md).toContain('包管理器:pnpm')
  })

  it('渲染脚本表', () => {
    const md = generateContextMarkdown(baseAppMap(), { items: [] })
    expect(md).toContain('## 脚本')
    expect(md).toContain('`next dev`')
  })

  it('渲染页面路由表', () => {
    const md = generateContextMarkdown(baseAppMap(), { items: [] })
    expect(md).toContain('## 页面路由')
    expect(md).toContain('`/login`')
  })

  it('渲染 API 路由', () => {
    const md = generateContextMarkdown(
      baseAppMap({ apiRoutes: [{ path: '/api/users', source: 'src/app/api/users/route.ts' }] }),
      { items: [] },
    )
    expect(md).toContain('## API 路由')
    expect(md).toContain('`/api/users`')
  })

  it('渲染选择器列表并截断到 100 个', () => {
    const items = Array.from({ length: 150 }, (_, i) => ({
      source: 's.tsx',
      kind: 'data-testid' as const,
      value: `id-${i}`,
      confidence: 0.95,
    }))
    const md = generateContextMarkdown(baseAppMap(), { items })
    expect(md).toContain('共发现 150 个 data-testid')
    expect(md).toContain('id-0')
    expect(md).toContain('id-99')
    expect(md).not.toContain('id-149')
    expect(md).toContain('另有 50 个')
  })
})
