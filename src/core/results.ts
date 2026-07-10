// Runtime 各方法的返回类型。
// ObservationResult 严格对齐 RUNTIME_SPEC.md;
// 其余 result 类型在 spec 中未给出完整字段,此处按 OUTPUT_SPEC.md 与各方法职责补充。
// 所有 result 都携带 errors: RuntimeError[],允许部分成功。

import type {
  AgentPlatform,
  ArtifactRef,
  AppMap,
  ConsoleMessageRecord,
  NetworkRequestRecord,
  ObservedElement,
  RecommendedSelector,
  RunFailure,
  RunSummary,
  SelectorMap,
  SkillDescriptor,
  TestCaseCase,
} from './models.js'
import type { RuntimeError } from './errors.js'

export interface PrepareResult {
  ok: boolean
  baseUrl?: string
  devServerStarted?: boolean
  pid?: number
  storageStatePath?: string
  errors: RuntimeError[]
}

export interface CleanupResult {
  ok: boolean
  devServerStopped?: boolean
  errors: RuntimeError[]
}

export interface ScanResult {
  ok: boolean
  appMap: AppMap
  selectorMap: SelectorMap
  contextPath?: string
  errors: RuntimeError[]
}

export interface ObservationResult {
  id: string
  url: string
  finalUrl: string
  title: string
  status?: number
  screenshot?: ArtifactRef
  domSnapshot?: ArtifactRef
  accessibilityTree?: unknown
  elements: ObservedElement[]
  consoleMessages: ConsoleMessageRecord[]
  networkRequests: NetworkRequestRecord[]
  recommendedSelectors: RecommendedSelector[]
  errors: RuntimeError[]
  createdAt: string
}

export interface RunResult {
  runId: string
  status: 'passed' | 'failed' | 'completed'
  startedAt: string
  endedAt: string
  summary: RunSummary
  failures: RunFailure[]
  artifacts?: ArtifactRef[]
  errors: RuntimeError[]
}

export interface ReportResult {
  ok: boolean
  runResultPath?: string
  failureSummaryPath?: string
  errors: RuntimeError[]
}

/** 单项自检结果。 */
export interface DoctorCheck {
  /** 检查项名称,例如 `node_version`。 */
  name: string
  ok: boolean
  /** 当前观测值,例如 "v20.10.0"。 */
  observed?: string
  /** 期望值,例如 ">=20"。 */
  expected?: string
  message?: string
}

export interface DoctorResult {
  ok: boolean
  checks: DoctorCheck[]
}

export interface GenerateResult {
  ok: boolean
  /** 生成的指令包绝对路径。 */
  briefPath?: string
  /** 建议外部 Agent 写入 spec 的绝对路径。 */
  suggestedSpecPath?: string
  /** 是否因缺失 scan 产物而自动触发了 scan。 */
  scanTriggered?: boolean
  errors: RuntimeError[]
}

// --- skill 命令相关返回 ---

export interface SkillListResult {
  ok: boolean
  /** 实际使用的平台。 */
  platform?: AgentPlatform
  /** 发现的 skill 列表。 */
  skills: SkillDescriptor[]
  errors: RuntimeError[]
}

export interface SkillValidateResult {
  ok: boolean
  /** 解析出的用例契约(可缺失)。 */
  testCase?: TestCaseCase
  errors: RuntimeError[]
}

export interface SkillGenerateResult {
  ok: boolean
  /** 生成的用例编写指令包绝对路径。 */
  briefPath?: string
  /** 建议外部 Agent 写入最终用例的绝对路径。 */
  suggestedCasePath?: string
  /** 是否因缺失 scan 产物而自动触发了 scan。 */
  scanTriggered?: boolean
  errors: RuntimeError[]
}

export interface CompileResult {
  ok: boolean
  /** 生成的 spec 绝对路径。 */
  specPath?: string
  /** 建议的执行命令(提示用)。 */
  suggestedRunCommand?: string
  errors: RuntimeError[]
}
