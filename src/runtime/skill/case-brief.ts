// case-brief:渲染「用例编写指令包」Markdown。
// 把 target + route + SKILL.md 规则 + references + 项目上下文 + case 契约空模板
// 组装为一份给外部编码 Agent 的 prompt。Runtime 不做推理、不调用 LLM。
//
// 设计完全对齐 runtime/spec-brief.ts:纯函数 + 行数组拼接,便于测试。
// 产物落 .auto-e2e/case-briefs/<slug>.md,供 Agent 据此填写
// tests/auto-e2e-cases/<module>/<slug>.md(最终用例契约)。

import type { AppMap, Config, SelectorMap } from '../../core/models.js'

/** generateCaseBrief 的输入。 */
export interface CaseBriefInput {
  /** skill 名称(用于标注来源)。 */
  skillName: string
  /** 用例 slug(同时作为指令包文件名与建议用例名)。 */
  slug: string
  /** 目标用例的自然语言描述。 */
  target: string
  /** 目标路由(可缺失,来自 target 推断或显式传入)。 */
  route?: string
  /** SKILL.md 全文(规则来源)。 */
  skillMarkdown?: string
  /** references 文件名 → 正文映射。 */
  references?: Record<string, string>
  /** 项目结构(来自 scan,可缺失)。 */
  appMap?: AppMap
  /** 可用选择器(来自 scan,可缺失)。 */
  selectorMap?: SelectorMap
  /** auto-e2e 配置(可缺失)。 */
  config?: Config
  /** 建议的最终用例输出路径(相对项目根,如 tests/auto-e2e-cases/pl/detail.md)。 */
  suggestedCasePath: string
}

/**
 * 生成用例编写指令包文本(纯函数,便于测试)。
 */
export function generateCaseBrief(input: CaseBriefInput): string {
  const lines: string[] = []

  lines.push(`# auto-e2e 用例编写指令包:${input.slug}`)
  lines.push('')
  lines.push(
    '> 本文件由 `auto-e2e skill generate` 自动生成。请据此编写一份**符合 auto-e2e 用例契约的 Markdown 用例**。',
  )
  lines.push(
    '> 完成后用 `auto-e2e skill validate --skill <skill>` 校验。auto-e2e 不做推理,用例内容由你(编码 Agent)编写。',
  )
  lines.push('')

  // --- 任务 ---
  lines.push('## 任务')
  lines.push('')
  lines.push(`依据 **${input.skillName}** skill 规则,为下面的「目标」编写一份 Markdown 用例契约,`)
  lines.push(`写入指定路径。只编写用例,不要改动业务代码。`)
  lines.push('')

  // --- 目标 ---
  lines.push('## 目标')
  lines.push('')
  lines.push(`- target: ${input.target}`)
  if (input.route) lines.push(`- route: \`${input.route}\``)
  lines.push('')

  // --- SKILL 规则 ---
  if (input.skillMarkdown !== undefined) {
    lines.push('## Skill 规则(SKILL.md)')
    lines.push('')
    lines.push('```markdown')
    lines.push(input.skillMarkdown.trim())
    lines.push('```')
    lines.push('')
  }

  if (input.references && Object.keys(input.references).length > 0) {
    lines.push('## Skill 参考资料(references)')
    lines.push('')
    for (const [name, body] of Object.entries(input.references)) {
      lines.push(`### ${name}`)
      lines.push('')
      lines.push('```markdown')
      lines.push(body.trim())
      lines.push('```')
      lines.push('')
    }
  }

  // --- 项目上下文(复用 scan 摘要) ---
  const appMap = input.appMap
  const config = input.config
  const selectorMap = input.selectorMap
  const hasContext = Boolean(appMap || selectorMap || config)
  if (hasContext) {
    lines.push('## 项目上下文')
    lines.push('')
    if (appMap) {
      lines.push(`- 框架:${appMap.framework}`)
      lines.push(`- 包管理器:${appMap.packageManager}`)
      if (appMap.playwright?.testDir) lines.push(`- 测试目录:\`${appMap.playwright.testDir}\``)
    }
    if (config?.baseUrl) lines.push(`- baseUrl:\`${config.baseUrl}\``)
    if (config?.storageState) lines.push(`- storageState:\`${config.storageState}\``)

    if (appMap && appMap.routes.length > 0) {
      lines.push('')
      lines.push('### 页面路由')
      lines.push('')
      for (const r of appMap.routes) lines.push(`- \`${r.path}\` ← \`${r.source}\``)
    }
    if (selectorMap && selectorMap.items.length > 0) {
      lines.push('')
      lines.push('### 可用选择器(data-testid)')
      lines.push('')
      const shown = selectorMap.items.slice(0, 30)
      for (const it of shown) lines.push(`- \`${it.value}\` ← \`${it.source}\``)
      if (selectorMap.items.length > shown.length) {
        lines.push(`- 另有 ${selectorMap.items.length - shown.length} 个,详见 selector-map.json`)
      }
    }
    lines.push('')
  }

  // --- 用例契约模板(待 Agent 填写) ---
  lines.push('## 用例契约模板(请填写)')
  lines.push('')
  lines.push(`将填好的用例写入:\`${input.suggestedCasePath}\``)
  lines.push('')
  lines.push('必填段:**Target / Preconditions / Steps / Assertions / Stability Notes**。')
  lines.push(
    '若 Steps 含写操作(创建/修改/删除/提交等),必须声明 **Write Operations**(testData + cleanup + idempotent)。',
  )
  lines.push('')
  lines.push('```markdown')
  lines.push(`# ${input.target}`)
  lines.push('')
  lines.push('## Target')
  if (input.route) lines.push(`- route: ${input.route}`)
  lines.push('- module: <填写模块>')
  lines.push('- type: <readonly-smoke | write | regression>')
  lines.push('')
  lines.push('## Preconditions')
  lines.push('- app: <环境前提>')
  lines.push('- auth: <登录/权限前提>')
  lines.push('- data: <数据前提>')
  lines.push('')
  lines.push('## Steps')
  lines.push('1. <步骤>')
  lines.push('2. <步骤>')
  lines.push('')
  lines.push('## Assertions')
  lines.push('- <断言>')
  lines.push('')
  lines.push('## Network Expectations')
  lines.push('- <期望的接口>')
  lines.push('')
  lines.push('## Stability Notes')
  lines.push('- 优先使用 role、label、visible text。')
  lines.push('- 禁止使用绝对 XPath、动态 id。')
  lines.push('```')
  lines.push('')

  // --- 下一步 ---
  lines.push('## 下一步')
  lines.push('')
  lines.push('```bash')
  lines.push(
    `auto-e2e skill validate --skill ${input.skillName} --case-file ${input.suggestedCasePath}`,
  )
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}
