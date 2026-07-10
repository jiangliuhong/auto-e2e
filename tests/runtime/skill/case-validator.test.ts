// case-validator 纯函数测试。
// 覆盖:合法用例通过、必填段缺失、写操作守门(缺声明/缺字段/声明完整)。

import { describe, expect, it } from 'vitest'
import {
  validateCaseMarkdown,
  validateParsedCase,
} from '../../../src/runtime/skill/case-validator.js'
import { parseCaseContract } from '../../../src/runtime/skill/case-contract.js'
import type { TestCaseCase } from '../../../src/core/models.js'

function baseValidCase(overrides: Partial<TestCaseCase> = {}): TestCaseCase {
  const base: TestCaseCase = {
    title: 'T',
    target: { route: '/x', module: 'm', type: 'readonly-smoke' },
    preconditions: ['app: dev server'],
    steps: ['打开页面', '等待加载'],
    assertions: ['标题可见'],
    networkExpectations: [],
    stabilityNotes: ['使用 role 定位'],
    rawSections: {},
  }
  return { ...base, ...overrides }
}

describe('validateParsedCase', () => {
  it('合法只读用例通过', () => {
    const result = validateParsedCase(baseValidCase())
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('缺 Target 段失败', () => {
    const result = validateParsedCase(baseValidCase({ target: undefined }))
    expect(result.ok).toBe(false)
    expect(
      result.errors.some(
        (e) => e.code === 'case_section_missing' && e.details?.section === 'Target',
      ),
    ).toBe(true)
  })

  it('Steps 为空失败', () => {
    const result = validateParsedCase(baseValidCase({ steps: [] }))
    expect(result.ok).toBe(false)
    expect(
      result.errors.some(
        (e) => e.code === 'case_section_missing' && e.details?.section === 'Steps',
      ),
    ).toBe(true)
  })

  it('Stability Notes 为空失败', () => {
    const result = validateParsedCase(baseValidCase({ stabilityNotes: [] }))
    expect(result.ok).toBe(false)
    expect(
      result.errors.some(
        (e) => e.code === 'case_section_missing' && e.details?.section === 'Stability Notes',
      ),
    ).toBe(true)
  })
})

describe('validateParsedCase 写操作守门', () => {
  it('Steps 含写入语义关键词但缺 Write Operations → 失败', () => {
    const result = validateParsedCase(baseValidCase({ steps: ['创建一条参数集记录'] }))
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'case_write_op_undeclared')).toBe(true)
  })

  it('英文关键词 submit/save/delete 同样触发守门', () => {
    expect(validateParsedCase(baseValidCase({ steps: ['submit the form'] })).ok).toBe(false)
    expect(validateParsedCase(baseValidCase({ steps: ['save changes'] })).ok).toBe(false)
    expect(validateParsedCase(baseValidCase({ steps: ['delete the record'] })).ok).toBe(false)
    expect(validateParsedCase(baseValidCase({ steps: ['update profile'] })).ok).toBe(false)
  })

  it('Write Operations 缺 cleanup → 失败', () => {
    const result = validateParsedCase(
      baseValidCase({
        steps: ['创建记录'],
        writeOperations: { testData: 'fixture', idempotent: true },
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.message.includes('cleanup'))).toBe(true)
  })

  it('Write Operations 缺 idempotent → 失败', () => {
    const result = validateParsedCase(
      baseValidCase({
        steps: ['创建记录'],
        writeOperations: { testData: 'fixture', cleanup: '删除' },
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.message.includes('idempotent'))).toBe(true)
  })

  it('Write Operations 完整声明 → 通过', () => {
    const result = validateParsedCase(
      baseValidCase({
        steps: ['创建记录'],
        writeOperations: { testData: 'fixture 唯一名', cleanup: '测试后删除', idempotent: true },
      }),
    )
    expect(result.ok).toBe(true)
  })

  it('只读用例不触发写操作守门', () => {
    expect(validateParsedCase(baseValidCase({ steps: ['打开页面', '展开说明'] })).ok).toBe(true)
  })
})

describe('validateCaseMarkdown', () => {
  const validMd = `# 用例

## Target
- route: /x

## Preconditions
- app: dev

## Steps
1. 打开页面
2. 等待加载

## Assertions
- 标题可见

## Stability Notes
- 使用 role 定位
`

  it('合法 Markdown 通过', () => {
    const result = validateCaseMarkdown(validMd)
    expect(result.ok).toBe(true)
  })

  it('缺必填段时报告所有缺失段', () => {
    const result = validateCaseMarkdown('# T\n## Target\n- route: /x\n')
    expect(result.ok).toBe(false)
    const missingSections = result.errors
      .filter((e) => e.code === 'case_section_missing')
      .map((e) => e.details?.section)
    expect(missingSections.sort()).toEqual([
      'Assertions',
      'Preconditions',
      'Stability Notes',
      'Steps',
    ])
  })

  it('无 H1 时返回解析失败错误', () => {
    const result = validateCaseMarkdown('## Target\n- route: /x')
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'case_parse_failed')).toBe(true)
  })

  it('端到端:含写操作的 Markdown 走守门', () => {
    const md = `# T
## Target
- route: /x
## Preconditions
- app: dev
## Steps
1. 提交一个新参数集
## Assertions
- 列表出现新项
## Stability Notes
- 使用 role 定位
`
    const result = validateCaseMarkdown(md)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'case_write_op_undeclared')).toBe(true)
  })

  it('与 parseCaseContract 结果一致(交叉验证)', () => {
    const parsed = parseCaseContract(validMd)
    expect('errors' in parsed).toBe(false)
    if ('errors' in parsed) return
    const direct = validateParsedCase(parsed)
    const fromMd = validateCaseMarkdown(validMd)
    expect(direct.ok).toBe(fromMd.ok)
  })
})
