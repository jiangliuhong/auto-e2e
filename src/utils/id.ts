// 生成稳定的、人类可读的标识符。
// 风格对齐 OUTPUT_SPEC.md 示例:obs_001 / run_001。

/** 生成形如 `run_001` 的递增编号 id;同一毫秒内递增计数保证唯一。 */
export function createId(prefix: string): string {
  const seq = (++SEQUENCE).toString().padStart(3, '0')
  return `${prefix}_${seq}`
}

/** 生成 observation id。 */
export function createObservationId(): string {
  return createId('obs')
}

/** 生成 run id。 */
export function createRunId(): string {
  return createId('run')
}

// 模块级自增序列。足够本进程内确定性唯一;跨进程/跨 run 的持久化编号由 storage 负责。
let SEQUENCE = 0
