// 集中定义 .auto-e2e/ 下的目录布局与文件路径。
// 严格对齐 OUTPUT_SPEC.md「目录布局」一节。
// 所有路径相对给定的 root(.auto-e2e/ 所在项目根)。

import path from 'node:path'

/** .auto-e2e 目录名。 */
export const RUNTIME_DIR = '.auto-e2e'

/** 返回 root 下 .auto-e2e/ 的绝对/相对路径。 */
export function runtimeDir(root: string): string {
  return path.join(root, RUNTIME_DIR)
}

// --- 顶层文件 ---

export function configPath(root: string): string {
  return path.join(runtimeDir(root), 'config.json')
}
export function appMapPath(root: string): string {
  return path.join(runtimeDir(root), 'app-map.json')
}
export function selectorMapPath(root: string): string {
  return path.join(runtimeDir(root), 'selector-map.json')
}
export function agentContextPath(root: string): string {
  return path.join(runtimeDir(root), 'agent-context.md')
}
/** 向后兼容别名,与 agent-context.md 内容相同。 */
export function codexContextPath(root: string): string {
  return path.join(runtimeDir(root), 'codex-context.md')
}
export function runResultPath(root: string): string {
  return path.join(runtimeDir(root), 'run-result.json')
}
export function failureSummaryPath(root: string): string {
  return path.join(runtimeDir(root), 'failure-summary.md')
}
export function storageStatePath(root: string): string {
  return path.join(runtimeDir(root), 'storage-state.json')
}
/** 受管 dev server 的 PID 文件(跨进程追踪 detached server)。 */
export function devServerPidPath(root: string): string {
  return path.join(runtimeDir(root), 'dev-server.pid')
}

// --- 子目录 ---

export function observationsDir(root: string): string {
  return path.join(runtimeDir(root), 'observations')
}
export function reportsDir(root: string): string {
  return path.join(runtimeDir(root), 'reports')
}
export function historyDir(root: string): string {
  return path.join(runtimeDir(root), 'history')
}
/** spec 生成指令包目录:`auto-e2e generate` 产出的 Markdown 存放处。 */
export function specBriefsDir(root: string): string {
  return path.join(runtimeDir(root), 'spec-briefs')
}
/** 用例编写指令包目录:`auto-e2e skill generate` 产出的 Markdown 存放处。 */
export function caseBriefsDir(root: string): string {
  return path.join(runtimeDir(root), 'case-briefs')
}

/** 单次 observation 的目录。 */
export function observationDir(root: string, observationId: string): string {
  return path.join(observationsDir(root), observationId)
}

/** 单次 run 的报告目录。 */
export function reportRunDir(root: string, runId: string): string {
  return path.join(reportsDir(root), runId)
}

/** 单个 spec 生成指令包文件路径:`spec-briefs/<name>.md`。 */
export function specBriefPath(root: string, name: string): string {
  return path.join(specBriefsDir(root), `${name}.md`)
}

/** 单个用例编写指令包文件路径:`case-briefs/<slug>.md`。 */
export function caseBriefPath(root: string, slug: string): string {
  return path.join(caseBriefsDir(root), `${slug}.md`)
}

/**
 * 列出 .auto-e2e/ 下应确保存在的所有目录(相对 root)。
 * 用于 ensureLayout()。
 */
export function layoutDirs(root: string): string[] {
  return [
    runtimeDir(root),
    observationsDir(root),
    reportsDir(root),
    historyDir(root),
    specBriefsDir(root),
    caseBriefsDir(root),
  ]
}
