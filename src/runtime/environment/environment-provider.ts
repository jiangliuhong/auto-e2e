// EnvironmentProvider 接口。对齐 PROVIDER_GUIDE.md「EnvironmentProvider」。
// 负责应用环境生命周期:启动、停止、就绪、健康检查。
// 实现见 local-node-environment.ts。

import type {
  CleanupOptions,
  CleanupResult,
  PrepareOptions,
  PrepareResult,
} from '../../core/index.js'
import type { HealthCheckResult } from './health-check.js'

export interface EnvironmentProvider {
  prepare(options?: PrepareOptions): Promise<PrepareResult>
  cleanup(options?: CleanupOptions): Promise<CleanupResult>
  healthCheck(baseUrl?: string): Promise<HealthCheckResult>
}
