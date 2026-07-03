// 把 AppMap + SelectorMap 渲染为 agent-context.md(机器与人类可读的 Markdown)。
// 对齐 AGENT_INIT_PROMPT.md「优先使用 agent-context.md 作为通用上下文文件」。
// codex-context.md 作为向后兼容别名,内容相同。

import type { AppMap, SelectorMap } from '../core/models.js'

/**
 * 生成 agent-context.md 文本(纯函数,便于测试)。
 */
export function generateContextMarkdown(appMap: AppMap, selectorMap: SelectorMap): string {
  const lines: string[] = []
  lines.push('# auto-e2e 项目上下文')
  lines.push('')
  lines.push('> 本文件由 `auto-e2e scan` 自动生成,供编码 Agent 读取以了解项目结构。')
  lines.push('')

  // 基本信息
  lines.push('## 基本信息')
  lines.push('')
  lines.push(`- 框架:${appMap.framework}`)
  lines.push(`- 包管理器:${appMap.packageManager}`)
  if (appMap.playwright?.configFile) {
    lines.push(`- Playwright 配置:\`${appMap.playwright.configFile}\``)
  }
  if (appMap.playwright?.testDir) {
    lines.push(`- 测试目录:\`${appMap.playwright.testDir}\``)
  }
  lines.push('')

  // 脚本
  const scriptEntries = Object.entries(appMap.scripts)
  if (scriptEntries.length > 0) {
    lines.push('## 脚本')
    lines.push('')
    lines.push('| 名称 | 命令 |')
    lines.push('| --- | --- |')
    for (const [name, cmd] of scriptEntries) {
      lines.push(`| \`${name}\` | \`${cmd}\` |`)
    }
    lines.push('')
  }

  // 路由
  if (appMap.routes.length > 0) {
    lines.push('## 页面路由')
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
    lines.push('## API 路由')
    lines.push('')
    lines.push('| 路径 | 源文件 |')
    lines.push('| --- | --- |')
    for (const r of appMap.apiRoutes) {
      lines.push(`| \`${r.path}\` | \`${r.source}\` |`)
    }
    lines.push('')
  }

  // 选择器
  lines.push('## 选择器(data-testid)')
  lines.push('')
  lines.push(`共发现 ${selectorMap.items.length} 个 data-testid。`)
  if (selectorMap.items.length > 0) {
    lines.push('')
    lines.push('| 值 | 首次出现于 |')
    lines.push('| --- | --- |')
    // 仅展示前 100 个,避免文件过长;完整列表见 selector-map.json
    const shown = selectorMap.items.slice(0, 100)
    for (const it of shown) {
      lines.push(`| \`${it.value}\` | \`${it.source}\` |`)
    }
    if (selectorMap.items.length > shown.length) {
      lines.push('')
      lines.push(
        `> 另有 ${selectorMap.items.length - shown.length} 个,详见 \`selector-map.json\`。`,
      )
    }
  }
  lines.push('')

  return lines.join('\n')
}
