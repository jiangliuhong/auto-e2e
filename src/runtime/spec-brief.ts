// generateSpecBrief:把「文本用例 + 项目上下文 + Playwright 编写规范」渲染为
// 一份 Spec 生成指令包(Markdown),供外部编码 Agent 据此编写标准 Playwright spec。
//
// 对齐 ARCHITECTURE.md「Runtime 不做推理」:本函数只做结构化拼接,不调用 LLM、
// 不猜测应用行为。spec 代码由外部 Agent 编写。
// 设计对齐 scanner/context-generator.ts:纯函数 + 行数组拼接,便于测试。

import type { AppMap, Config, SelectorMap } from '../core/models.js'

/** generateSpecBrief 的输入。 */
export interface SpecBriefInput {
  /** 用例名称(同时作为指令包文件名与建议 spec 名)。 */
  name: string
  /** 文本用例原文。 */
  description: string
  /** 项目结构(来自 scan,可缺失)。 */
  appMap?: AppMap
  /** 可用选择器(来自 scan,可缺失)。 */
  selectorMap?: SelectorMap
  /** auto-e2e 配置(可缺失)。 */
  config?: Config
  /** 建议的 spec 输出路径(相对项目根,如 e2e/login.spec.ts)。 */
  suggestedSpecPath: string
}

/**
 * 生成 Spec 生成指令包文本(纯函数,便于测试)。
 */
export function generateSpecBrief(input: SpecBriefInput): string {
  const lines: string[] = []

  lines.push(`# auto-e2e Spec 生成指令包:${input.name}`)
  lines.push('')
  lines.push(
    '> 本文件由 `auto-e2e generate` 自动生成。请据此编写一个**标准 Playwright spec 文件**,',
  )
  lines.push(
    '> 完成后用 `auto-e2e run --spec <目标 spec 路径>` 执行。auto-e2e 不做推理,spec 代码由你(编码 Agent)编写。',
  )
  lines.push('')

  // --- 任务 ---
  lines.push('## 任务')
  lines.push('')
  lines.push('将下面的「文本用例」转换为**标准 Playwright spec**(`.spec.ts`),写入指定路径。')
  lines.push('只编写测试代码,不要改动业务代码。')
  lines.push('')

  // --- 文本用例 ---
  lines.push('## 文本用例')
  lines.push('')
  lines.push('```text')
  lines.push(input.description)
  lines.push('```')
  lines.push('')

  // --- 目标 spec 路径 ---
  lines.push('## 目标 spec 路径')
  lines.push('')
  lines.push(`请将 spec 写入:\`${input.suggestedSpecPath}\``)
  lines.push('')

  // --- 项目上下文 ---
  const appMap = input.appMap
  const selectorMap = input.selectorMap
  const config = input.config

  const hasContext = Boolean(appMap || selectorMap || config)
  if (hasContext) {
    lines.push('## 项目上下文')
    lines.push('')

    // 基本信息
    lines.push('### 基本信息')
    lines.push('')
    if (appMap) {
      lines.push(`- 框架:${appMap.framework}`)
      lines.push(`- 包管理器:${appMap.packageManager}`)
      if (appMap.playwright?.configFile) {
        lines.push(`- Playwright 配置:\`${appMap.playwright.configFile}\``)
      }
      if (appMap.playwright?.testDir) {
        lines.push(`- 测试目录:\`${appMap.playwright.testDir}\``)
      }
    }
    if (config?.baseUrl) lines.push(`- baseUrl:\`${config.baseUrl}\``)
    if (config?.browser) lines.push(`- 默认浏览器:${config.browser}`)
    if (config?.storageState) lines.push(`- storageState:\`${config.storageState}\``)
    lines.push('')

    // 脚本表
    if (appMap) {
      const scriptEntries = Object.entries(appMap.scripts)
      if (scriptEntries.length > 0) {
        lines.push('### 脚本')
        lines.push('')
        lines.push('| 名称 | 命令 |')
        lines.push('| --- | --- |')
        for (const [name, cmd] of scriptEntries) {
          lines.push(`| \`${name}\` | \`${cmd}\` |`)
        }
        lines.push('')
      }

      // 页面路由
      if (appMap.routes.length > 0) {
        lines.push('### 页面路由')
        lines.push('')
        lines.push('| 路径 | 源文件 |')
        lines.push('| --- | --- |')
        for (const r of appMap.routes) {
          lines.push(`| \`${r.path}\` | \`${r.source}\` |`)
        }
        lines.push('')
      }

      // API 路由
      if (appMap.apiRoutes.length > 0) {
        lines.push('### API 路由')
        lines.push('')
        lines.push('| 路径 | 源文件 |')
        lines.push('| --- | --- |')
        for (const r of appMap.apiRoutes) {
          lines.push(`| \`${r.path}\` | \`${r.source}\` |`)
        }
        lines.push('')
      }
    }

    // 选择器(data-testid)
    const items = selectorMap?.items ?? []
    lines.push('### 可用选择器(data-testid)')
    lines.push('')
    lines.push(`共发现 ${items.length} 个 data-testid。`)
    if (items.length > 0) {
      lines.push('')
      lines.push('| 值 | 首次出现于 |')
      lines.push('| --- | --- |')
      // 仅展示前 100 个,避免文件过长;完整列表见 selector-map.json
      const shown = items.slice(0, 100)
      for (const it of shown) {
        lines.push(`| \`${it.value}\` | \`${it.source}\` |`)
      }
      if (items.length > shown.length) {
        lines.push('')
        lines.push(`> 另有 ${items.length - shown.length} 个,详见 \`selector-map.json\`。`)
      }
    }
    lines.push('')
  } else {
    lines.push('## 项目上下文')
    lines.push('')
    lines.push('> 未发现项目上下文(尚未执行 `auto-e2e scan`)。建议先运行 `auto-e2e scan`,')
    lines.push('> 以获取可用路由与 data-testid 选择器,提升 spec 质量与稳定性。')
    lines.push('')
  }

  // --- Playwright 编写规范 ---
  lines.push('## Playwright 编写规范')
  lines.push('')
  lines.push('对齐 AGENTS.md,优先使用以下稳定定位器:')
  lines.push('')
  lines.push('- `getByRole` / `getByLabel` / `getByPlaceholder`')
  lines.push('- `data-testid`(见上方「可用选择器」表)')
  lines.push('')
  lines.push('避免:')
  lines.push('')
  lines.push('- `nth-child`、生成的 CSS 类名')
  lines.push('- 过长的 CSS 选择器')
  lines.push('- 任意的超时值')
  lines.push('')
  if (config?.baseUrl) {
    lines.push(`baseUrl 已配置(\`${config.baseUrl}\`),\`page.goto('/login')\` 使用相对路径即可。`)
    lines.push('')
  }

  // --- 验收标准 ---
  lines.push('## 验收标准')
  lines.push('')
  lines.push(
    '1. 产出物必须是**标准 Playwright spec**,可被 `auto-e2e run --spec <目标 spec 路径>` 直接执行。',
  )
  lines.push('2. 断言显式、稳定、可复现。')
  lines.push('3. 不改动业务代码。')
  lines.push('')

  // --- 下一步 ---
  lines.push('## 下一步')
  lines.push('')
  lines.push('```bash')
  lines.push('auto-e2e prepare')
  lines.push(`auto-e2e run --spec ${input.suggestedSpecPath}`)
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}
