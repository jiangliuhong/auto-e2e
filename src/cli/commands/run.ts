// `auto-e2e run` 命令。
// 执行 Playwright 测试并收集结果(trace/截图/视频引用)。
// 委托 DefaultRuntime.run()。CLI 仅编排与输出。

import path from 'node:path'
import { Command } from 'commander'
import { createRuntime } from '../../runtime/factory.js'
import { printInfo, printRuntimeError, printSuccess } from '../output.js'
import { toRuntimeError } from '../../utils/errors.js'
import type { RunOptions } from '../../core/index.js'

export function makeRunCommand(): Command {
  return new Command('run')
    .description('执行 Playwright 测试,生成 run-result.json 与归档报告')
    .option('--root <path>', '项目根目录', process.cwd())
    .option('--spec <file>', '仅运行指定 spec 文件')
    .option('--suite <name>', '仅运行指定 suite')
    .option('--tag <grep>', '按 tag(grep)过滤测试')
    .option('--headed', '以有头模式运行浏览器')
    .option('--browser <name>', '覆盖默认浏览器(chromium/firefox/webkit)')
    .option('--update-snapshots', '更新快照基线')
    .option('--retries <n>', '失败重试次数', (v: string) => Number.parseInt(v, 10))
    .action(
      async (cmdOpts: {
        root?: string
        spec?: string
        suite?: string
        tag?: string
        headed?: boolean
        browser?: RunOptions['browser']
        updateSnapshots?: boolean
        retries?: number
      }) => {
        const root = path.resolve(cmdOpts.root ?? process.cwd())
        try {
          const runtime = createRuntime({ projectRoot: root })
          const result = await runtime.run({
            ...(cmdOpts.spec !== undefined ? { spec: cmdOpts.spec } : {}),
            ...(cmdOpts.suite !== undefined ? { suite: cmdOpts.suite } : {}),
            ...(cmdOpts.tag !== undefined ? { tag: cmdOpts.tag } : {}),
            ...(cmdOpts.headed ? { headed: true } : {}),
            ...(cmdOpts.browser !== undefined ? { browser: cmdOpts.browser } : {}),
            ...(cmdOpts.updateSnapshots ? { updateSnapshots: true } : {}),
            ...(cmdOpts.retries !== undefined ? { retries: cmdOpts.retries } : {}),
          })

          for (const e of result.errors) printRuntimeError(e)

          // RunResult 用 status 而非 ok 判定结果(passed/failed/completed)。
          if (result.errors.length === 0) {
            const s = result.summary
            printSuccess(
              `测试完成:${result.status}(总计 ${s.total},通过 ${s.passed},失败 ${s.failed},跳过 ${s.skipped})`,
            )
            if (result.runId) printInfo(`run id: ${result.runId}`)
            printInfo(`run-result: ${path.join(root, '.auto-e2e', 'run-result.json')}`)
            if (result.runId) {
              printInfo(
                `归档报告: ${path.join(root, '.auto-e2e', 'reports', result.runId, 'run-result.json')}`,
              )
            }
            if (result.failures.length > 0) {
              printInfo(`失败用例 ${result.failures.length} 个:`)
              for (const f of result.failures) {
                const loc = f.line !== undefined ? `${f.file}:${f.line}` : f.file
                printInfo(`  - ${f.title} (${loc})`)
              }
            }
          }

          // 退出码:有错误或测试失败 → 1;否则 0。
          process.exitCode = result.errors.length > 0 || result.status === 'failed' ? 1 : 0
        } catch (err) {
          printRuntimeError(toRuntimeError(err, { code: 'run_failed' }))
          process.exitCode = 1
        }
      },
    )
}
