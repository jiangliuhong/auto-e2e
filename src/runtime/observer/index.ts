// Observer 占位。实际实现在路线图阶段 4。
// 当前仅导出接口契约,供 DefaultRuntime 在未实现时返回 notImplementedError。

import type { ObserveOptions, ObservationResult } from '../../core/index.js'

export interface Observer {
  observe(options: ObserveOptions): Promise<ObservationResult>
}
