// Feedback 占位。实际实现在路线图阶段 6。

import type { ReportOptions, ReportResult } from '../../core/index.js'

export interface Feedback {
  report(options?: ReportOptions): Promise<ReportResult>
}
