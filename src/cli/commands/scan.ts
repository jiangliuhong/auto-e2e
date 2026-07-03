// `auto-e2e scan` 命令。
// 扫描项目结构,产出 app-map.json / selector-map.json / agent-context.md。
// 委托 DefaultRuntime.scan()。CLI 仅编排与输出。

import path from 'node:path'
import { Command } from 'commander'
import { createRuntime } from '../../runtime/factory.js'
import { printInfo, printRuntimeError, printSuccess } from '../output.js'
import { toRuntimeError } from '../../utils/errors.js'

export function makeScanCommand(): Command {
  return new Command('scan')
    .description('扫描项目结构,生成 app-map / selector-map / agent-context')
    .option('--root <path>', '项目根目录', process.cwd())
    .action(async (cmdOpts: { root?: string }) => {
      const root = path.resolve(cmdOpts.root ?? process.cwd())
      try {
        const runtime = createRuntime({ projectRoot: root })
        const result = await runtime.scan({ projectRoot: root })
        for (const e of result.errors) printRuntimeError(e)
        if (result.ok) {
          printSuccess(
            `扫描完成:框架=${result.appMap.framework},路由=${result.appMap.routes.length},选择器=${result.selectorMap.items.length}`,
          )
          if (result.contextPath) printInfo(`agent-context: ${result.contextPath}`)
        }
        process.exitCode = result.ok ? 0 : 1
      } catch (err) {
        printRuntimeError(toRuntimeError(err, { code: 'scan_failed' }))
        process.exitCode = 1
      }
    })
}
