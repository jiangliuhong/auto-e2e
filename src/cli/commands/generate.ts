// `auto-e2e generate` 命令。
// 接收一条文本用例,把它和项目上下文(路由/选择器)+ Playwright 编写规范组装为
// 一份「Spec 生成指令包」(Markdown),写入 .auto-e2e/spec-briefs/<name>.md。
// 外部编码 Agent 据此编写标准 Playwright spec,再用 `auto-e2e run --spec` 执行。
// 委托 DefaultRuntime.generate()。CLI 仅编排与输出,业务逻辑不进 CLI。

import path from 'node:path'
import { Command } from 'commander'
import { createRuntime } from '../../runtime/factory.js'
import { printInfo, printRuntimeError, printSuccess } from '../output.js'
import { toRuntimeError } from '../../utils/errors.js'
import type { GenerateOptions } from '../../core/index.js'

export function makeGenerateCommand(): Command {
  return new Command('generate')
    .description('把文本用例转换为 Spec 生成指令包(供编码 Agent 编写标准 Playwright spec)')
    .requiredOption('--name <name>', '用例名称(同时作为指令包文件名与建议 spec 名)')
    .option('--case <text>', '文本用例内容(与 --case-file 二选一)')
    .option('--case-file <file>', '文本用例文件路径(与 --case 二选一)')
    .option('--spec-dir <dir>', '覆盖建议的 spec 输出目录')
    .option('--root <path>', '项目根目录', process.cwd())
    .option('--force', '覆盖已存在的指令包')
    .action(
      async (cmdOpts: {
        name: string
        case?: string
        caseFile?: string
        specDir?: string
        root?: string
        force?: boolean
      }) => {
        const root = path.resolve(cmdOpts.root ?? process.cwd())
        try {
          const runtime = createRuntime({ projectRoot: root })
          const opts: GenerateOptions = {
            name: cmdOpts.name,
            ...(cmdOpts.case !== undefined ? { description: cmdOpts.case } : {}),
            ...(cmdOpts.caseFile !== undefined ? { caseFile: cmdOpts.caseFile } : {}),
            ...(cmdOpts.specDir !== undefined ? { specDir: cmdOpts.specDir } : {}),
            ...(cmdOpts.force ? { force: true } : {}),
          }
          const result = await runtime.generate(opts)

          for (const e of result.errors) printRuntimeError(e)

          if (result.ok) {
            printSuccess(`指令包已生成:${cmdOpts.name}`)
            if (result.briefPath) printInfo(`agent-brief: ${result.briefPath}`)
            if (result.suggestedSpecPath) {
              printInfo(`建议 spec 路径: ${result.suggestedSpecPath}`)
            }
            if (result.scanTriggered) {
              printInfo('未发现 scan 产物,已自动触发 auto-e2e scan 以补充上下文。')
            }
            const specForRun = result.suggestedSpecPath ?? cmdOpts.name
            printInfo(
              `下一步: 由编码 Agent 依据指令包编写 spec,再执行 \`auto-e2e run --spec ${specForRun}\``,
            )
          }

          process.exitCode = result.ok ? 0 : 1
        } catch (err) {
          printRuntimeError(toRuntimeError(err, { code: 'generate_failed' }))
          process.exitCode = 1
        }
      },
    )
}
