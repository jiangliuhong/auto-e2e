// Executor 接口与默认实现。
// 接口对齐 AutoE2ERuntime.run();默认实现 PlaywrightExecutor 见 playwright-executor.ts。

import type { RunOptions, RunResult } from '../../core/index.js'

export interface Executor {
  run(options?: RunOptions): Promise<RunResult>
}

export * from './playwright-executor.js'
