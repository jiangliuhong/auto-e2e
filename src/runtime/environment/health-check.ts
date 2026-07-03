// 健康检查结果类型。

export interface HealthCheckResult {
  ok: boolean
  status?: number
  latencyMs?: number
  message?: string
}
