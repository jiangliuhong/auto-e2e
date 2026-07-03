// AutoE2ERuntime:Runtime 的稳定公共契约。
// 严格对齐 RUNTIME_SPEC.md「核心 Runtime 接口」一节。
// CLI 只依赖此接口;具体实现通过依赖注入提供(见 runtime/default-runtime.ts)。

import type {
  CleanupOptions,
  DoctorOptions,
  GenerateOptions,
  ObserveOptions,
  PrepareOptions,
  ReportOptions,
  RunOptions,
  ScanOptions,
} from './options.js'
import type {
  CleanupResult,
  DoctorResult,
  GenerateResult,
  ObservationResult,
  PrepareResult,
  ReportResult,
  RunResult,
  ScanResult,
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
}
