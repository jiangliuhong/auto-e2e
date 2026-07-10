// case-brief 渲染器纯函数测试。
// 覆盖:基本结构、skill 规则/references 嵌入、项目上下文、契约模板、route 预填。

import { describe, expect, it } from 'vitest'
import { generateCaseBrief } from '../../../src/runtime/skill/case-brief.js'
import type { AppMap, SelectorMap } from '../../../src/core/models.js'

function appMapFixture(): AppMap {
  return {
    framework: 'nextjs',
    packageManager: 'pnpm',
    scripts: { dev: 'next dev' },
    routes: [{ path: '/login', source: 'app/login/page.tsx' }],
    apiRoutes: [],
    playwright: { configFile: 'playwright.config.ts', testDir: 'e2e' },
  }
}

function selectorFixture(): SelectorMap {
  return {
    items: [{ source: 'Button.tsx', kind: 'data-testid', value: 'submit-btn', confidence: 0.9 }],
  }
}

describe('generateCaseBrief', () => {
  it('包含标题、任务、目标、契约模板、下一步', () => {
    const md = generateCaseBrief({
      skillName: 'case-writer',
      slug: 'pl-detail',
      target: 'PL 参数集详情页',
      suggestedCasePath: 'tests/auto-e2e-cases/pl/pl-detail.md',
    })
    expect(md).toContain('用例编写指令包:pl-detail')
    expect(md).toContain('## 任务')
    expect(md).toContain('## 目标')
    expect(md).toContain('target: PL 参数集详情页')
    expect(md).toContain('## 用例契约模板(请填写)')
    expect(md).toContain('tests/auto-e2e-cases/pl/pl-detail.md')
    expect(md).toContain('auto-e2e skill validate')
  })

  it('route 被预填到目标与契约模板', () => {
    const md = generateCaseBrief({
      skillName: 'case-writer',
      slug: 'pl-detail',
      target: 'PL 参数集详情页',
      route: '/global/pl-report/parameters?country=mx',
      suggestedCasePath: 'tests/auto-e2e-cases/pl/pl-detail.md',
    })
    expect(md).toContain('route: `/global/pl-report/parameters?country=mx`')
    expect(md).toContain('route: /global/pl-report/parameters?country=mx')
  })

  it('嵌入 SKILL.md 规则与 references', () => {
    const md = generateCaseBrief({
      skillName: 'case-writer',
      slug: 'pl-detail',
      target: 'PL 参数集详情页',
      skillMarkdown: '# Case Writer\n写稳定的 role 定位用例。',
      references: {
        'case-schema.md': 'schema body',
        'auth-rules.md': 'auth body',
      },
      suggestedCasePath: 'tests/auto-e2e-cases/pl/pl-detail.md',
    })
    expect(md).toContain('## Skill 规则(SKILL.md)')
    expect(md).toContain('# Case Writer')
    expect(md).toContain('## Skill 参考资料(references)')
    expect(md).toContain('### case-schema.md')
    expect(md).toContain('schema body')
    expect(md).toContain('### auth-rules.md')
    expect(md).toContain('auth body')
  })

  it('嵌入项目上下文(框架、路由、选择器)', () => {
    const md = generateCaseBrief({
      skillName: 'case-writer',
      slug: 'pl-detail',
      target: 'PL 参数集详情页',
      appMap: appMapFixture(),
      selectorMap: selectorFixture(),
      config: { baseUrl: 'http://localhost:3000', storageState: '.auth/state.json' },
      suggestedCasePath: 'tests/auto-e2e-cases/pl/pl-detail.md',
    })
    expect(md).toContain('## 项目上下文')
    expect(md).toContain('框架:nextjs')
    expect(md).toContain('baseUrl:`http://localhost:3000`')
    expect(md).toContain('storageState:`.auth/state.json`')
    expect(md).toContain('/login')
    expect(md).toContain('submit-btn')
  })

  it('无上下文时不渲染项目上下文段', () => {
    const md = generateCaseBrief({
      skillName: 'case-writer',
      slug: 'pl-detail',
      target: 'PL 参数集详情页',
      suggestedCasePath: 'tests/auto-e2e-cases/pl/pl-detail.md',
    })
    expect(md).not.toContain('## 项目上下文')
  })

  it('契约模板列出必填段与写操作守门提示', () => {
    const md = generateCaseBrief({
      skillName: 'case-writer',
      slug: 'pl-detail',
      target: 'PL 参数集详情页',
      suggestedCasePath: 'tests/auto-e2e-cases/pl/pl-detail.md',
    })
    expect(md).toContain('Target / Preconditions / Steps / Assertions / Stability Notes')
    expect(md).toContain('Write Operations')
    expect(md).toContain('idempotent')
  })
})
