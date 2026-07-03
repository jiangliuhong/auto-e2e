// `auto-e2e prepare` 命令。
// 启动 dev server 并等待就绪,创建 storageState 占位。
// 委托 DefaultRuntime.prepare() / cleanup()。CLI 仅编排与输出。

import path from 'node:path'
import { Command } from 'commander'
import { createRuntime } from '../../runtime/factory.js'
import { printInfo, printRuntimeError, printSuccess } from '../output.js'
import { toRuntimeError } from '../../utils/errors.js'

export function makePrepareCommand(): Command {
  return new Command('prepare')
    .description('启动 dev server 并等待就绪(创建 .auto-e2e/ 与 storageState)')
    .option('--root <path>', '项目根目录', process.cwd())
    .option('--base-url <url>', '覆盖 config.baseUrl 进行就绪探测')
    .option('--dev-command <cmd>', '覆盖 config.devCommand')
    .option('--timeout <ms>', '就绪探测超时(毫秒)', (v: string) => Number.parseInt(v, 10))
    .option('--cleanup', '停止受管的 dev server 后退出')
    .action(
      async (cmdOpts: {
        root?: string
        baseUrl?: string
        devCommand?: string
        timeout?: number
        cleanup?: boolean
      }) => {
        const root = path.resolve(cmdOpts.root ?? process.cwd())
        try {
          const runtime = createRuntime({ projectRoot: root })
          if (cmdOpts.cleanup) {
            const result = await runtime.cleanup()
            for (const e of result.errors) printRuntimeError(e)
            if (result.ok) printSuccess('dev server 已停止')
            process.exitCode = result.ok ? 0 : 1
            return
          }
          const result = await runtime.prepare({
            baseUrl: cmdOpts.baseUrl,
            devCommand: cmdOpts.devCommand,
            readyTimeoutMs: cmdOpts.timeout,
          })
          for (const e of result.errors) printRuntimeError(e)
          if (result.ok) {
            printSuccess('环境已就绪')
            if (result.baseUrl) printInfo(`base url: ${result.baseUrl}`)
            if (result.pid) printInfo(`dev server pid: ${result.pid}`)
            if (result.storageStatePath) printInfo(`storage state: ${result.storageStatePath}`)
          }
          process.exitCode = result.ok ? 0 : 1
        } catch (err) {
          printRuntimeError(toRuntimeError(err, { code: 'prepare_failed' }))
          process.exitCode = 1
        }
      },
    )
}
