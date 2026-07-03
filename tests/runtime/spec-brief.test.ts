import { describe, expect, it } from 'vitest'
import { generateSpecBrief } from '../../src/runtime/spec-brief.js'
import type { AppMap, Config, SelectorMap } from '../../src/core/models.js'

function baseAppMap(over: Partial<AppMap> = {}): AppMap {
  return {
    framework: 'nextjs',
    packageManager: 'pnpm',
    scripts: { dev: 'next dev', build: 'next build' },
    routes: [{ path: '/login', source: 'src/app/login/page.tsx' }],
    apiRoutes: [],
    playwright: { configFile: 'playwright.config.ts', testDir: 'e2e/specs' },
    ...over,
  }
}

function baseConfig(over: Partial<Config> = {}): Config {
  return {
    baseUrl: 'http://localhost:3000',
    playwrightConfig: 'playwright.config.ts',
    browser: 'chromium',
    ...over,
  }
}

describe('generateSpecBrief (纯函数)', () => {
  it('包含任务、文本用例原文与目标 spec 路径', () => {
    const md = generateSpecBrief({
      name: 'login',
      description: '用户用 demo/demo1234 登录,应跳转到 /dashboard',
      suggestedSpecPath: 'e2e/login.spec.ts',
    })

    expect(md).toContain('Spec 生成指令包:login')
    expect(md).toContain('用户用 demo/demo1234 登录,应跳转到 /dashboard')
    expect(md).toContain('`e2e/login.spec.ts`')
    expect(md).toContain('标准 Playwright spec')
    expect(md).toContain('auto-e2e run --spec e2e/login.spec.ts')
  })

  it('渲染项目基本信息、脚本与页面路由', () => {
    const md = generateSpecBrief({
      name: 'login',
      description: '登录',
      appMap: baseAppMap(),
      config: baseConfig(),
      suggestedSpecPath: 'e2e/specs/login.spec.ts',
    })

    expect(md).toContain('框架:nextjs')
    expect(md).toContain('包管理器:pnpm')
    expect(md).toContain('测试目录:`e2e/specs`')
    expect(md).toContain('baseUrl:`http://localhost:3000`')
    expect(md).toContain('默认浏览器:chromium')
    expect(md).toContain('| `dev` | `next dev` |')
    expect(md).toContain('| `/login` | `src/app/login/page.tsx` |')
  })

  it('渲染选择器表并截断到 100 个', () => {
    const items = Array.from({ length: 150 }, (_, i) => ({
      source: 's.tsx',
      kind: 'data-testid' as const,
      value: `id-${i}`,
      confidence: 0.95,
    }))
    const md = generateSpecBrief({
      name: 'x',
      description: 'd',
      selectorMap: { items } satisfies SelectorMap,
      suggestedSpecPath: 'e2e/x.spec.ts',
    })

    expect(md).toContain('共发现 150 个 data-testid')
    expect(md).toContain('`id-0`')
    expect(md).toContain('`id-99`')
    expect(md).not.toContain('`id-149`')
    expect(md).toContain('另有 50 个')
  })

  it('包含 Playwright 编写规范要点', () => {
    const md = generateSpecBrief({
      name: 'x',
      description: 'd',
      config: baseConfig(),
      suggestedSpecPath: 'e2e/x.spec.ts',
    })

    expect(md).toContain('getByRole')
    expect(md).toContain('getByLabel')
    expect(md).toContain('data-testid')
    expect(md).toContain('nth-child')
    expect(md).toContain("page.goto('/login')")
    expect(md).toContain('## 验收标准')
  })

  it('无上下文时给出 scan 提示', () => {
    const md = generateSpecBrief({
      name: 'x',
      description: 'd',
      suggestedSpecPath: 'e2e/x.spec.ts',
    })

    expect(md).toContain('未发现项目上下文')
    expect(md).toContain('auto-e2e scan')
    // 无上下文时不应渲染路由表
    expect(md).not.toContain('页面路由')
  })

  it('空路由/空选择器时不渲染对应表头', () => {
    const md = generateSpecBrief({
      name: 'x',
      description: 'd',
      appMap: baseAppMap({ routes: [] }),
      selectorMap: { items: [] },
      suggestedSpecPath: 'e2e/x.spec.ts',
    })

    expect(md).toContain('共发现 0 个 data-testid')
    expect(md).not.toContain('| 路径 | 源文件 |')
  })
})
