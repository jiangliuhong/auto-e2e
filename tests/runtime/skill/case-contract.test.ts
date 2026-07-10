// case-contract 解析器纯函数测试。
// 覆盖:合法用例、缺 H1、各段解析、Target/Write Operations 结构化、未识别段保留。

import { describe, expect, it } from 'vitest'
import {
  extractTitle,
  parseCaseContract,
  parseListItems,
  parseTargetSection,
  parseWriteOperationsSection,
  splitSections,
} from '../../../src/runtime/skill/case-contract.js'

describe('extractTitle', () => {
  it('提取首个 H1 标题文本', () => {
    expect(extractTitle('# P&L 参数集详情页展示')).toBe('P&L 参数集详情页展示')
  })

  it('忽略前导非标题行', () => {
    expect(extractTitle('\n\n# 标题')).toBe('标题')
  })

  it('无 H1 时返回 undefined', () => {
    expect(extractTitle('## 仅二级')).toBeUndefined()
  })

  it('不把二级标题误判为 H1', () => {
    expect(extractTitle('## 不是标题')).toBeUndefined()
  })
})

describe('splitSections', () => {
  it('按二级标题切分,段名为键、正文为值', () => {
    const md = `# T

## Target
- route: /a

## Steps
1. 第一步
2. 第二步
`
    const s = splitSections(md)
    expect(s['Target']).toContain('route: /a')
    expect(s['Steps']).toContain('第一步')
    expect(Object.keys(s).sort()).toEqual(['Steps', 'Target'])
  })

  it('保留段名大小写与空格', () => {
    const s = splitSections('## Network Expectations\n- GET /api\n')
    expect(s['Network Expectations']).toContain('GET /api')
  })

  it('三级标题不切分二级段', () => {
    const s = splitSections('## Steps\n### 子标题\n- item\n')
    expect(s['Steps']).toContain('### 子标题')
    expect(s['Steps']).toContain('item')
    expect(Object.keys(s)).toEqual(['Steps'])
  })
})

describe('parseListItems', () => {
  it('解析无序与有序列表项', () => {
    expect(parseListItems('- a\n- b')).toEqual(['a', 'b'])
    expect(parseListItems('1. first\n2. second')).toEqual(['first', 'second'])
  })

  it('解析星号列表项', () => {
    expect(parseListItems('* one\n* two')).toEqual(['one', 'two'])
  })

  it('空段返回空数组', () => {
    expect(parseListItems(undefined)).toEqual([])
    expect(parseListItems('')).toEqual([])
    expect(parseListItems('   \n  ')).toEqual([])
  })

  it('非列表纯文本行整体保留为一项', () => {
    expect(parseListItems('纯文本行')).toEqual(['纯文本行'])
  })
})

describe('parseTargetSection', () => {
  it('解析 route/module/type 键值行', () => {
    expect(
      parseTargetSection(
        '- route: /global/pl-report/parameters?country=mx\n- module: pl-forecast\n- type: readonly-smoke',
      ),
    ).toEqual({
      route: '/global/pl-report/parameters?country=mx',
      module: 'pl-forecast',
      type: 'readonly-smoke',
    })
  })

  it('支持中文冒号', () => {
    expect(parseTargetSection('- route：/login')).toEqual({ route: '/login' })
  })

  it('空段返回 undefined', () => {
    expect(parseTargetSection(undefined)).toBeUndefined()
    expect(parseTargetSection('')).toBeUndefined()
  })

  it('无可识别字段时返回 undefined', () => {
    expect(parseTargetSection('- foo: bar')).toBeUndefined()
  })
})

describe('parseWriteOperationsSection', () => {
  it('解析 testData/cleanup/idempotent', () => {
    expect(
      parseWriteOperationsSection(
        '- testData: 由 fixture 提供唯一名\n- cleanup: 测试后删除该记录\n- idempotent: true',
      ),
    ).toEqual({
      testData: '由 fixture 提供唯一名',
      cleanup: '测试后删除该记录',
      idempotent: true,
    })
  })

  it('idempotent 非 true/yes/1 时为 false', () => {
    expect(parseWriteOperationsSection('- idempotent: no')).toEqual({ idempotent: false })
  })

  it('空段返回 undefined', () => {
    expect(parseWriteOperationsSection(undefined)).toBeUndefined()
  })
})

describe('parseCaseContract', () => {
  const validMarkdown = `# P&L 参数集详情页展示

## Target
- route: /global/pl-report/parameters?country=mx
- module: pl-forecast
- type: readonly-smoke

## Preconditions
- app: web + api development server
- auth: use development login helper

## Steps
1. 登录具备菜单权限的用户。
2. 打开 \`/global/pl-report/parameters?country=mx\`。
3. 等待参数集列表加载完成。

## Assertions
- 页面标题可见。
- 参数集选择器可见。

## Network Expectations
- GET /api/auth/oauth/all-users

## Stability Notes
- 优先使用 role、label、visible text。
- 禁止使用绝对 XPath。
`

  it('解析完整合法用例', () => {
    const result = parseCaseContract(validMarkdown)
    expect('errors' in result).toBe(false)
    if ('errors' in result) return
    expect(result.title).toBe('P&L 参数集详情页展示')
    expect(result.target).toEqual({
      route: '/global/pl-report/parameters?country=mx',
      module: 'pl-forecast',
      type: 'readonly-smoke',
    })
    expect(result.preconditions).toHaveLength(2)
    expect(result.steps).toHaveLength(3)
    expect(result.assertions).toHaveLength(2)
    expect(result.networkExpectations).toEqual(['GET /api/auth/oauth/all-users'])
    expect(result.stabilityNotes).toHaveLength(2)
    expect(result.writeOperations).toBeUndefined()
    expect(result.rawSections).toEqual({})
  })

  it('保留未识别段到 rawSections', () => {
    const md = `# T

## Target
- route: /x

## Preconditions
- a

## Steps
1. s

## Assertions
- a

## Stability Notes
- n

## Custom Section
custom body
`
    const result = parseCaseContract(md)
    expect('errors' in result).toBe(false)
    if ('errors' in result) return
    expect(result.rawSections['Custom Section']).toContain('custom body')
  })

  it('Write Operations 段被结构化', () => {
    const md = `# T

## Target
- route: /x

## Steps
1. 创建一条记录

## Write Operations
- testData: fixture
- cleanup: 删除
- idempotent: true
`
    const result = parseCaseContract(md)
    expect('errors' in result).toBe(false)
    if ('errors' in result) return
    expect(result.writeOperations).toEqual({
      testData: 'fixture',
      cleanup: '删除',
      idempotent: true,
    })
  })

  it('缺 H1 标题时解析失败', () => {
    const result = parseCaseContract('## Target\n- route: /x')
    expect('errors' in result).toBe(true)
    if (!('errors' in result)) return
    expect(result.errors.some((e) => e.includes('H1'))).toBe(true)
  })
})
