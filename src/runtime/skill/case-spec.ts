// case-spec:把已校验的 TestCaseCase **确定性**渲染为 Playwright .spec.ts 骨架。
// 对齐 ARCHITECTURE.md「Runtime 不做推理」:只做模板映射,不调用 LLM、不猜测应用行为。
// 凡是契约/config 已显式给出的(route、network、viewport、storageState)都做实;
// 凡是需要应用语义推断的(真实定位器、断言选择器)都留 TODO + 原文。
//
// 设计对齐 runtime/spec-brief.ts:纯函数 + 行数组拼接,便于测试。
// 产物是可提交资产(spec 骨架),由编码 Agent 补全 TODO 后 `auto-e2e run --spec` 执行。

import type { AppMap, Config, TestCaseCase } from '../../core/models.js'

/** generateCaseSpec 的输入。 */
export interface CaseSpecInput {
  /** 解析后的用例契约。 */
  testCase: TestCaseCase
  /** 用例 slug(同时作为 spec 文件名与 test 名)。 */
  slug: string
  /** auto-e2e 配置(可缺失,用于 viewport/storageState/baseUrl)。 */
  config?: Config
  /** 项目结构(可缺失,目前未消费,预留扩展)。 */
  appMap?: AppMap
  /** 用例契约来源文件名(用于顶部注释溯源)。 */
  sourceFile?: string
}

/**
 * 渲染 Playwright spec 骨架文本(纯函数,便于测试)。
 */
export function generateCaseSpec(input: CaseSpecInput): string {
  const lines: string[] = []
  const tc = input.testCase
  const config = input.config

  // --- 头部注释 + import ---
  lines.push(`/**`)
  lines.push(` * 由 auto-e2e compile 生成。`)
  lines.push(` * 骨架基于用例契约;真实选择器与断言需编码 Agent 补全 TODO。`)
  if (input.sourceFile) lines.push(` * 用例契约来源:${input.sourceFile}`)
  lines.push(` */`)
  lines.push(`import { test, expect } from '@playwright/test'`)
  lines.push('')

  // --- test.use(viewport / storageState) ---
  const useLines: string[] = []
  if (config?.viewport) {
    useLines.push(
      `  viewport: { width: ${config.viewport.width}, height: ${config.viewport.height} },`,
    )
  }
  if (config?.storageState) {
    useLines.push(`  storageState: '${escapeString(config.storageState)}',`)
  }
  if (useLines.length > 0) {
    lines.push(`test.use({`)
    lines.push(...useLines)
    lines.push(`})`)
    lines.push('')
  }

  // --- describe + test ---
  const title = tc.title.replace(/'/g, "\\'")
  const slug = escapeString(input.slug)
  lines.push(`test.describe('${title}', () => {`)
  lines.push(`  test('${slug}', async ({ page }) => {`)

  // --- 4xx/5xx 拦截断言(只读用例或 Stability Notes 提及 401/403/500 时加) ---
  if (shouldGuardHttpErrors(tc)) {
    lines.push(
      `    // 稳定性约束:页面不应出现 4xx/5xx 响应(来自 Stability Notes / readonly 类型)。`,
    )
    lines.push(`    const errorResponses: number[] = []`)
    lines.push(`    page.on('response', (response) => {`)
    lines.push(`      if (response.status() >= 400) errorResponses.push(response.status())`)
    lines.push(`    })`)
    lines.push('')
  }

  // --- Network Expectations(确定性:契约给了方法+路径)---
  if (tc.networkExpectations.length > 0) {
    lines.push(`    // --- Network Expectations(确定性拦截 + 计数断言)---`)
    for (const req of tc.networkExpectations) {
      const parsed = parseNetworkExpectation(req)
      const urlGlob = parsed.urlGlob
      lines.push(`    let ${parsed.counterVar} = 0`)
      lines.push(`    await page.route('${escapeString(urlGlob)}', async (route) => {`)
      lines.push(`      ${parsed.counterVar} += 1`)
      lines.push(`      await route.continue()`)
      lines.push(`    })`)
    }
    lines.push('')
  }

  // --- goto(契约给了 route 时做实)---
  if (tc.target?.route) {
    const route = tc.target.route
    // baseUrl 存在时用相对路径更地道;否则原样。
    lines.push(`    // 目标路由(来自契约 Target)`)
    lines.push(`    await page.goto('${escapeString(route)}')`)
    lines.push('')
  }

  // --- Steps(骨架:原文进 test.step + TODO)---
  if (tc.steps.length > 0) {
    lines.push(`    // --- Steps(骨架,真实步骤需补全)---`)
    tc.steps.forEach((step, idx) => {
      const stepTitle = `${idx + 1}. ${step}`.replace(/'/g, "\\'")
      lines.push(`    await test.step('${stepTitle}', async () => {`)
      lines.push(`      /** TODO: 实现该步骤。契约原文:${sanitizeComment(step)} */`)
      lines.push(`    })`)
    })
    lines.push('')
  }

  // --- Assertions(占位 + 原文注释)---
  if (tc.assertions.length > 0) {
    lines.push(`    // --- Assertions(占位,真实选择器需补全)---`)
    for (const assertion of tc.assertions) {
      lines.push(`    // TODO: ${sanitizeComment(assertion)}`)
      lines.push(`    await expect(page.getByText(/.*/).first()).toBeVisible() // 占位`)
    }
    lines.push('')
  }

  // --- Network Expectations 计数断言 ---
  if (tc.networkExpectations.length > 0) {
    lines.push(`    // --- Network Expectations 计数断言 ---`)
    for (const req of tc.networkExpectations) {
      const parsed = parseNetworkExpectation(req)
      lines.push(
        `    expect(${parsed.counterVar}).toBeGreaterThan(0) // ${sanitizeComment(req)} 命中至少一次`,
      )
    }
    lines.push('')
  }

  // --- 4xx/5xx 收尾断言 ---
  if (shouldGuardHttpErrors(tc)) {
    lines.push(`    // 无 4xx/5xx 响应`)
    lines.push(`    expect(errorResponses).toEqual([])`)
    lines.push('')
  }

  lines.push(`  })`)
  lines.push(`})`)
  lines.push('')

  return lines.join('\n')
}

/**
 * 判断是否需要 4xx/5xx 拦截断言。
 * 触发条件:用例类型含 readonly,或 Stability Notes 提及 401/403/500/4xx/5xx。
 */
function shouldGuardHttpErrors(tc: TestCaseCase): boolean {
  if (tc.target?.type && /readonly/i.test(tc.target.type)) return true
  return tc.stabilityNotes.some((n) => /\b(40[0-9]|50[0-9]|4xx|5xx)\b/i.test(n))
}

/** 解析一条 Network Expectation(形如 `GET /api/pl/forecast/parameter-sets`)。 */
function parseNetworkExpectation(raw: string): { counterVar: string; urlGlob: string } {
  // 去掉前导方法(METHOD path),取路径部分。
  const m = /^([A-Z]+)\s+(.+)$/.exec(raw.trim())
  const urlPath = m && m[2] ? m[2].trim() : raw.trim()
  // 转 glob:**/<path>(兼容任意 host)。去掉 query 串以稳定匹配。
  const pathWithoutQuery = urlPath.split('?')[0] ?? urlPath
  const urlGlob = `**${pathWithoutQuery}`
  // counterVar:从 path 派生稳定标识符。
  const ident = pathWithoutQuery
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return { counterVar: `${ident || 'request'}Count`, urlGlob }
}

/** 净化放入注释的文本:转义块注释终止符,替换换行避免视觉错乱。 */
function sanitizeComment(value: string): string {
  // 用 split/join 避免在正则字面量里出现注释结束序列(否则会干扰转译器)。
  const blockCommentClose = String.fromCharCode(42) + '/'
  return value.split(blockCommentClose).join('*\\/').replace(/\n/g, ' ')
}

/** 转义字符串字面量(单引号、反斜杠、换行)。 */
function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}
