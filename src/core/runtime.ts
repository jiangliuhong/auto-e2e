// AutoE2ERuntime:Runtime 的稳定公共契约。
// 严格对齐 RUNTIME_SPEC.md「核心 Runtime 接口」一节。
// CLI 只依赖此接口;具体实现通过依赖注入提供(见 runtime/default-runtime.ts)。

import type {
  CleanupOptions,
  CompileOptions,
  DoctorOptions,
  GenerateOptions,
  ObserveOptions,
  PrepareOptions,
  ReportOptions,
  RunOptions,
  ScanOptions,
  SkillGenerateOptions,
  SkillListOptions,
  SkillValidateOptions,
} from './options.js'
import type {
  CleanupResult,
  CompileResult,
  DoctorResult,
  GenerateResult,
  ObservationResult,
  PrepareResult,
  ReportResult,
  RunResult,
  ScanResult,
  SkillGenerateResult,
  SkillListResult,
  SkillValidateResult,
} from './results.js'

export interface AutoE2ERuntime {
  prepare(options?: PrepareOptions): Promise<PrepareResult>
  cleanup(options?: CleanupOptions): Promise<CleanupResult>
  scan(options?: ScanOptions): Promise<ScanResult>
  observe(options: ObserveOptions): Promise<ObservationResult>
  run(options?: RunOptions): Promise<RunResult>
  report(options?: ReportOptions): Promise<ReportResult>
  doctor(options?: DoctorOptions): Promise<DoctorResult>
  generate(options: GenerateOptions): Promise<GenerateResult>
  /** 发现指定平台下的全部 skill。 */
  skillList(options?: SkillListOptions): Promise<SkillListResult>
  /** 校验用例 Markdown 是否符合契约(并可校验 skill 存在性)。 */
  skillValidate(options: SkillValidateOptions): Promise<SkillValidateResult>
  /** 依据 skill 规则 + target,生成「用例编写指令包」(供外部 Agent 编写用例)。 */
  skillGenerate(options: SkillGenerateOptions): Promise<SkillGenerateResult>
  /** 把已校验的 Markdown 用例契约确定性编译为 Playwright spec 骨架。 */
  compile(options: CompileOptions): Promise<CompileResult>
}
