// Runtime 各方法的入参类型。
// ObserveOptions / RunOptions 严格对齐 RUNTIME_SPEC.md;
// PrepareOptions / CleanupOptions / ScanOptions / ReportOptions / DoctorOptions
// 在 spec 中未给出完整字段,此处按 OUTPUT_SPEC.md 与 PROVIDER_GUIDE.md 补充,
// 并以注释标注来源,保证后续阶段可平滑扩展。

import type { AgentPlatform, Viewport } from './models.js'

/** prepare() 入参。 */
export interface PrepareOptions {
  /** 覆盖 config 中的 baseUrl 进行就绪探测。 */
  baseUrl?: string
  /** 覆盖 config 中的 dev 命令。 */
  devCommand?: string
  /** 就绪探测总超时(毫秒)。 */
  readyTimeoutMs?: number
  /** 是否启动 dev server(默认 true)。 */
  startDevServer?: boolean
}

/** cleanup() 入参。 */
export interface CleanupOptions {
  /** 是否一并删除 .auto-e2e/ 历史(默认 false,对齐 RUNTIME_SPEC.md)。 */
  purgeHistory?: boolean
}

/** scan() 入参。 */
export interface ScanOptions {
  /** 项目根目录,默认 cwd。 */
  projectRoot?: string
  /** 是否在扫描后(重新)生成 agent-context.md(默认 true)。 */
  generateContext?: boolean
}

/** observe() 入参。严格对齐 RUNTIME_SPEC.md。 */
export interface ObserveOptions {
  url: string
  viewport?: Viewport
  storageState?: string
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
  timeoutMs?: number
  outputDir?: string
}

/** run() 入参。严格对齐 RUNTIME_SPEC.md。 */
export interface RunOptions {
  spec?: string
  suite?: string
  tag?: string
  headed?: boolean
  browser?: 'chromium' | 'firefox' | 'webkit'
  updateSnapshots?: boolean
  retries?: number
}

/** report() 入参。 */
export interface ReportOptions {
  /** 针对指定 runId 生成报告(留空则取最近一次)。 */
  runId?: string
}

/** doctor() 入参。 */
export interface DoctorOptions {
  /** 是否跳过 baseUrl 可达性检查(在离线/无 dev server 时)。 */
  skipReachability?: boolean
}

/** generate() 入参。 */
export interface GenerateOptions {
  /** 项目根目录,默认 cwd。 */
  projectRoot?: string
  /**
   * 用例名称,同时作为指令包文件名与建议 spec 名
   * (例如 "login" → spec-briefs/login.md 与 <testDir>/login.spec.ts)。必填。
   */
  name: string
  /** 文本用例内容(与 caseFile 二选一)。 */
  description?: string
  /** 文本用例文件路径(与 description 二选一)。 */
  caseFile?: string
  /** 覆盖建议的 spec 输出目录(默认取 app-map.playwright.testDir,回退 "e2e")。 */
  specDir?: string
  /** 覆盖已存在的指令包(默认 false)。 */
  force?: boolean
}

// --- skill 命令相关入参 ---

/** skillList() 入参。 */
export interface SkillListOptions {
  /** 项目根目录,默认取 runtime 的 projectRoot。 */
  projectRoot?: string
  /** 覆盖 config.agentPlatform(codex/claude/zcode)。 */
  platform?: AgentPlatform
}

/** skillValidate() 入参。 */
export interface SkillValidateOptions {
  /** 项目根目录,默认取 runtime 的 projectRoot。 */
  projectRoot?: string
  /** 要校验的 skill 名称(可选;若提供则校验该 skill 存在)。 */
  skill?: string
  /** 待校验的用例 Markdown 文本(与 caseFile 二选一)。 */
  caseMarkdown?: string
  /** 待校验的用例 Markdown 文件路径(与 caseMarkdown 二选一)。 */
  caseFile?: string
}

/** skillGenerate() 入参。 */
export interface SkillGenerateOptions {
  /** 项目根目录,默认取 runtime 的 projectRoot。 */
  projectRoot?: string
  /** skill 名称(必填)。 */
  skill: string
  /** 用例目标的自然语言描述(必填)。 */
  target: string
  /** 用例 slug(同时作为指令包文件名);留空时由 CLI 层从 target 派生。 */
  slug?: string
  /** 目标路由(可缺失)。 */
  route?: string
  /** 覆盖 config.agentPlatform。 */
  platform?: AgentPlatform
  /** 覆盖建议的最终用例输出目录(默认 tests/auto-e2e-cases)。 */
  caseDir?: string
  /** 覆盖已存在的指令包(默认 false)。 */
  force?: boolean
}

/** compile() 入参。 */
export interface CompileOptions {
  /** 项目根目录,默认取 runtime 的 projectRoot。 */
  projectRoot?: string
  /** 用例 Markdown 文件路径(相对项目根或绝对)。 */
  caseFile: string
  /** spec 输出路径(相对项目根或绝对),例如 tests/auto-e2e-generated/x.spec.ts。 */
  out: string
  /** 覆盖已存在的 spec(默认 false)。 */
  force?: boolean
}
