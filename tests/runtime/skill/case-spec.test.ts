// case-spec 渲染器纯函数测试。
// 覆盖:基本结构、goto、steps 骨架、assertions 占位、network 拦截+计数、
// 4xx/5xx 守卫、viewport/storageState、确定性原则(不推断定位器)。

import { describe, expect, it } from 'vitest'
import { generateCaseSpec } from '../../../src/runtime/skill/case-spec.js'
import { parseCaseContract } from '../../../src/runtime/skill/case-contract.js'
import type { Config, TestCaseCase } from '../../../src/core/models.js'

function baseCase(overrides: Partial<TestCaseCase> = {}): TestCaseCase {
  const base: TestCaseCase = {
    title: 'P&L 参数集详情页',
    target: {
      route: '/global/pl-report/parameters?country=mx',
      module: 'pl-forecast',
      type: 'readonly-smoke',
    },
    preconditions: ['app: dev server'],
    steps: ['登录具备菜单权限的用户。', '打开参数集列表。'],
    assertions: ['页面标题可见。', '参数集选择器可见。'],
    networkExpectations: ['GET /api/pl/forecast/parameter-sets'],
    stabilityNotes: ['优先使用 role、label。', '禁止使用绝对 XPath。'],
    rawSections: {},
  }
  return { ...base, ...overrides }
}

describe('generateCaseSpec 基本结构', () => {
  it('包含 import、describe、test、收尾括号', () => {
    const spec = generateCaseSpec({ testCase: baseCase(), slug: 'pl-detail' })
    expect(spec).toContain("import { test, expect } from '@playwright/test'")
    expect(spec).toContain("test.describe('P&L 参数集详情页', () => {")
    expect(spec).toContain("test('pl-detail', async ({ page }) => {")
    expect(spec.trim().endsWith('})')).toBe(true)
  })

  it('头部注释含溯源(当提供 sourceFile)', () => {
    const spec = generateCaseSpec({
      testCase: baseCase(),
      slug: 'pl-detail',
      sourceFile: 'tests/auto-e2e-cases/pl/pl-detail.md',
    })
    expect(spec).toContain('用例契约来源:tests/auto-e2e-cases/pl/pl-detail.md')
  })
})

describe('generateCaseSpec route → goto', () => {
  it('契约给了 route → 生成 page.goto', () => {
    const spec = generateCaseSpec({ testCase: baseCase(), slug: 'pl-detail' })
    expect(spec).toContain("await page.goto('/global/pl-report/parameters?country=mx')")
  })

  it('契约无 route → 不生成 goto', () => {
    const spec = generateCaseSpec({
      testCase: baseCase({ target: { module: 'm', type: 'readonly-smoke' } }),
      slug: 's',
    })
    expect(spec).not.toContain('page.goto')
  })

  it('route 含特殊字符被正确转义(不破坏语法)', () => {
    const spec = generateCaseSpec({
      testCase: baseCase({ target: { route: "/a/b?x='c" } }),
      slug: 's',
    })
    expect(spec).toContain("page.goto('/a/b?x=\\'c')")
  })
})

describe('generateCaseSpec Steps 骨架(不推断定位器)', () => {
  it('每个 Step → test.step + TODO 注释含原文', () => {
    const spec = generateCaseSpec({ testCase: baseCase(), slug: 's' })
    expect(spec).toContain("await test.step('1. 登录具备菜单权限的用户。', async () => {")
    expect(spec).toContain("await test.step('2. 打开参数集列表。', async () => {")
    expect(spec).toContain('TODO: 实现该步骤。契约原文:登录具备菜单权限的用户。')
  })

  it('无 Steps → 不渲染 Steps 节', () => {
    const spec = generateCaseSpec({ testCase: baseCase({ steps: [] }), slug: 's' })
    expect(spec).not.toContain('test.step')
  })
})

describe('generateCaseSpec Assertions 占位', () => {
  it('每个 Assertion → TODO 注释 + expect 占位', () => {
    const spec = generateCaseSpec({ testCase: baseCase(), slug: 's' })
    expect(spec).toContain('// TODO: 页面标题可见。')
    expect(spec).toContain('// TODO: 参数集选择器可见。')
    // 占位断言(确定性,不推断真实选择器)
    expect(spec).toContain('await expect(page.getByText(/.*/).first()).toBeVisible() // 占位')
  })
})

describe('generateCaseSpec Network Expectations', () => {
  it('GET path → page.route 拦截 + 计数变量 + 计数断言', () => {
    const spec = generateCaseSpec({ testCase: baseCase(), slug: 's' })
    expect(spec).toContain('let api_pl_forecast_parameter_setsCount = 0')
    expect(spec).toContain("await page.route('**/api/pl/forecast/parameter-sets'")
    expect(spec).toContain('api_pl_forecast_parameter_setsCount += 1')
    expect(spec).toContain('expect(api_pl_forecast_parameter_setsCount).toBeGreaterThan(0)')
  })

  it('无 method 前缀时按 path 处理', () => {
    const spec = generateCaseSpec({
      testCase: baseCase({ networkExpectations: ['/api/foo'] }),
      slug: 's',
    })
    expect(spec).toContain('let api_fooCount = 0')
    expect(spec).toContain("'**/api/foo'")
  })
})

describe('generateCaseSpec 4xx/5xx 守卫', () => {
  it('readonly 类型 → 加 4xx/5xx 拦截断言', () => {
    const spec = generateCaseSpec({ testCase: baseCase(), slug: 's' }) // type 含 readonly
    expect(spec).toContain('const errorResponses: number[] = []')
    expect(spec).toContain("page.on('response', (response) => {")
    expect(spec).toContain('expect(errorResponses).toEqual([])')
  })

  it('非 readonly 且 Stability Notes 提 401/403/500 → 加守卫', () => {
    const spec = generateCaseSpec({
      testCase: baseCase({
        target: { route: '/x', type: 'write' },
        stabilityNotes: ['页面无 401、403、500。'],
      }),
      slug: 's',
    })
    expect(spec).toContain('errorResponses')
  })

  it('非 readonly 且 Stability Notes 不提错误码 → 不加守卫', () => {
    const spec = generateCaseSpec({
      testCase: baseCase({
        target: { route: '/x', type: 'write' },
        stabilityNotes: ['用 role 定位。'],
      }),
      slug: 's',
    })
    expect(spec).not.toContain('errorResponses')
  })
})

describe('generateCaseSpec config → test.use', () => {
  const config: Config = {
    baseUrl: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    storageState: '.auth/state.json',
  }

  it('viewport + storageState → test.use', () => {
    const spec = generateCaseSpec({ testCase: baseCase(), slug: 's', config })
    expect(spec).toContain('test.use({')
    expect(spec).toContain('viewport: { width: 1280, height: 720 },')
    expect(spec).toContain("storageState: '.auth/state.json',")
  })

  it('无 config → 不渲染 test.use', () => {
    const spec = generateCaseSpec({ testCase: baseCase(), slug: 's' })
    expect(spec).not.toContain('test.use({')
  })
})

describe('generateCaseSpec 端到端(从 Markdown 解析→渲染)', () => {
  const markdown = `# 用例标题

## Target
- route: /login
- module: auth
- type: readonly-smoke

## Preconditions
- app: dev

## Steps
1. 打开登录页
2. 点击登录按钮

## Assertions
- 跳转到 /dashboard
- 显示欢迎语

## Network Expectations
- POST /api/auth/login

## Stability Notes
- 用 role 定位
- 无 401/403
`

  it('解析 + 渲染:产物含全部段且无 undefined', () => {
    const parsed = parseCaseContract(markdown)
    expect('errors' in parsed).toBe(false)
    if ('errors' in parsed) return
    const spec = generateCaseSpec({ testCase: parsed, slug: 'auth-login' })
    expect(spec).not.toContain('undefined')
    expect(spec).toContain("test.describe('用例标题'")
    expect(spec).toContain("test('auth-login'")
    expect(spec).toContain("page.goto('/login')")
    expect(spec).toContain("'1. 打开登录页'")
    expect(spec).toContain("'2. 点击登录按钮'")
    expect(spec).toContain('api_auth_loginCount')
    expect(spec).toContain('errorResponses')
  })
})
