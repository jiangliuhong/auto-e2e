// case-contract:把 Markdown 用例契约文本**确定性**解析为 TestCaseCase。
// 对齐 AGENTS.md「Runtime 不做推理」:解析是纯文本切分,不调用 LLM、不猜测语义。
// 设计对齐 scanner/context-generator.ts 的「Markdown 即行数组」哲学,零三方依赖。
//
// 支持的二级标题段(其余段进入 rawSections 保留原文):
//   ## Target              → 结构化为 { route, module, type }
//   ## Preconditions       → 列表项数组
//   ## Steps               → 有序步骤数组
//   ## Assertions          → 断言数组
//   ## Network Expectations→ 接口期望数组
//   ## Stability Notes     → 稳定性约束数组
//   ## Write Operations    → { testData, cleanup, idempotent }(可选)

import type { TestCaseCase, TestCaseTarget, TestCaseWriteOperations } from '../../core/models.js'

/** 解析失败时返回 null(调用方据此生成校验错误)。 */
export interface CaseContractParseFailure {
  errors: string[]
}

/** 解析结果:成功返回 case,失败返回 { errors }。 */
export type CaseContractParseResult = TestCaseCase | CaseContractParseFailure

/**
 * 解析 Markdown 用例契约为 TestCaseCase(纯函数)。
 * 缺少 H1 标题视为失败;缺少二级段不在此判定(由校验器负责)。
 */
export function parseCaseContract(markdown: string): CaseContractParseResult {
  const errors: string[] = []

  const title = extractTitle(markdown)
  if (title === undefined) {
    errors.push('缺少 H1 标题(用 `# 标题` 声明用例名称)。')
    return { errors }
  }

  const sections = splitSections(markdown)
  const target = parseTargetSection(sections['Target'])
  const preconditions = parseListItems(sections['Preconditions'])
  const steps = parseListItems(sections['Steps'])
  const assertions = parseListItems(sections['Assertions'])
  const networkExpectations = parseListItems(sections['Network Expectations'])
  const stabilityNotes = parseListItems(sections['Stability Notes'])
  const writeOperations = parseWriteOperationsSection(sections['Write Operations'])

  // 未识别的二级标题段(排除已知段)保留原文。
  const known = new Set([
    'Target',
    'Preconditions',
    'Steps',
    'Assertions',
    'Network Expectations',
    'Stability Notes',
    'Write Operations',
  ])
  const rawSections: Record<string, string> = {}
  for (const [name, body] of Object.entries(sections)) {
    if (!known.has(name)) rawSections[name] = body
  }

  const testCase: TestCaseCase = {
    title,
    ...(target ? { target } : {}),
    preconditions,
    steps,
    assertions,
    networkExpectations,
    stabilityNotes,
    ...(writeOperations ? { writeOperations } : {}),
    rawSections,
  }
  return testCase
}

/**
 * 把 Markdown 文本按二级标题(`## `)切分为 { 段名: 段正文 }。
 * H1 与首个 H2 之间的正文被忽略(用例契约正文从 H2 开始)。
 * 段名保留原始大小写与空格,便于与契约约定精确匹配。
 */
export function splitSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = markdown.split('\n')
  let currentName: string | null = null
  let buffer: string[] = []
  for (const line of lines) {
    const h2 = matchHeading2(line)
    if (h2 !== null) {
      if (currentName !== null) sections[currentName] = buffer.join('\n').trim()
      currentName = h2
      buffer = []
    } else if (currentName !== null) {
      buffer.push(line)
    }
  }
  if (currentName !== null) sections[currentName] = buffer.join('\n').trim()
  return sections
}

/** 提取首个 H1 标题文本;无则返回 undefined。 */
export function extractTitle(markdown: string): string | undefined {
  const lines = markdown.split('\n')
  for (const line of lines) {
    const m = /^#\s+(.+?)\s*$/.exec(line)
    if (m && m[1]) return m[1].trim()
  }
  return undefined
}

/**
 * 匹配二级标题行;返回去空白后的标题文本,非 H2 返回 null。
 * 不匹配三级及以上标题(`### `)。
 */
function matchHeading2(line: string): string | null {
  const m = /^##\s+(?!\s|#)(.+?)\s*$/.exec(line)
  return m && m[1] ? m[1].trim() : null
}

/**
 * 把段正文解析为列表项:支持 `- ` / `* ` Markdown 列表,以及 `1. ` 有序项。
 * 非列表行(纯文本)整体作为一项保留,避免丢失内容。
 */
export function parseListItems(body: string | undefined): string[] {
  if (body === undefined || body.trim() === '') return []
  const items: string[] = []
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    const item = stripListItemMarker(line)
    if (item !== '') items.push(item)
  }
  return items
}

/** 去除行首的列表标记(`- ` / `* ` / `1. ` 等),返回正文。非列表行原样返回。 */
function stripListItemMarker(line: string): string {
  const m = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(line)
  return m && m[1] ? m[1].trim() : line.trim()
}

/**
 * 解析 Target 段为结构化字段。支持两种写法:
 *   - 行内键值:`- route: /xxx` / `- module: xxx` / `- type: xxx`
 *   - 行内 URL(单行即为 route)
 */
export function parseTargetSection(body: string | undefined): TestCaseTarget | undefined {
  if (body === undefined || body.trim() === '') return undefined
  const target: TestCaseTarget = {}
  const items = parseListItems(body)
  let hasAny = false
  for (const item of items) {
    const m = /^([A-Za-z][A-Za-z0-9 _-]*?)\s*[:：]\s*(.+)$/.exec(item)
    if (m && m[1] && m[2]) {
      const key = m[1].trim().toLowerCase()
      const value = m[2].trim()
      if (key === 'route') {
        target.route = value
        hasAny = true
      } else if (key === 'module') {
        target.module = value
        hasAny = true
      } else if (key === 'type') {
        target.type = value
        hasAny = true
      }
    }
  }
  return hasAny ? target : undefined
}

/**
 * 解析 Write Operations 段为结构化字段。
 * 支持键值行:`- testData: ...` / `- cleanup: ...` / `- idempotent: true`。
 */
export function parseWriteOperationsSection(
  body: string | undefined,
): TestCaseWriteOperations | undefined {
  if (body === undefined || body.trim() === '') return undefined
  const ops: TestCaseWriteOperations = {}
  const items = parseListItems(body)
  let hasAny = false
  for (const item of items) {
    const m = /^([A-Za-z][A-Za-z0-9 _-]*?)\s*[:：]\s*(.+)$/.exec(item)
    if (m && m[1] && m[2]) {
      const key = m[1].trim().toLowerCase()
      const value = m[2].trim()
      if (key === 'testdata' || key === 'test data') {
        ops.testData = value
        hasAny = true
      } else if (key === 'cleanup') {
        ops.cleanup = value
        hasAny = true
      } else if (key === 'idempotent') {
        ops.idempotent = parseBooleanish(value)
        hasAny = true
      }
    }
  }
  return hasAny ? ops : undefined
}

/** 把字符串解析为布尔:支持 true/yes/1(其余为 false)。 */
function parseBooleanish(value: string): boolean {
  return /^(true|yes|1)$/i.test(value.trim())
}
