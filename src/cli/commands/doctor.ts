// `auto-e2e doctor` 命令。
// 仅编排:调用 runtime.doctor() → 打印检查项 → 设置退出码。
// 核心逻辑在 runtime/doctor.ts(CLI 不含业务逻辑)。

import path from 'node:path'
import { Command } from 'commander'
import { createRuntime } from '../../runtime/factory.js'
import { printInfo } from '../output.js'

export function makeDoctorCommand(): Command {
  return new Command('doctor')
    .description('检查项目是否具备运行 auto-e2e 的条件')
    .option('--root <path>', '项目根目录', process.cwd())
    .option('--skip-reachability', '跳过 baseUrl 可达性检查')
    .action(async (cmdOpts: { root?: string; skipReachability?: boolean }) => {
      const root = path.resolve(cmdOpts.root ?? process.cwd())
      const runtime = createRuntime({ projectRoot: root })
      const result = await runtime.doctor({ skipReachability: cmdOpts.skipReachability })
      for (const c of result.checks) {
        const mark = c.ok ? '✓' : '✗'
        const obs = c.observed ? ` — ${c.observed}` : ''
        const msg = c.message ? ` (${c.message})` : ''
        printInfo(`${mark} ${c.name}${obs}${msg}`)
      }
      process.exitCode = result.ok ? 0 : 1
    })
}
