// `auto-e2e compile` 命令。
// 把已校验的 Markdown 用例契约确定性编译为 Playwright spec 骨架(.spec.ts)。
// Runtime 不做推理:真实选择器/断言需编码 Agent 补全 TODO。
// CLI 仅编排:解析参数 → 调用 Runtime.compile() → 输出 → 设置退出码。

import path from 'node:path'
import { Command } from 'commander'
import { createRuntime } from '../../runtime/factory.js'
import { printInfo, printRuntimeError, printSuccess } from '../output.js'
import { toRuntimeError } from '../../utils/errors.js'
import type { CompileOptions } from '../../core/index.js'

export function makeCompileCommand(): Command {
  return new Command('compile')
    .description('把已校验的 Markdown 用例契约编译为 Playwright spec 骨架(.spec.ts)')
    .argument('<caseFile>', '用例 Markdown 文件路径')
    .requiredOption('--out <file>', 'spec 输出路径(如 tests/auto-e2e-generated/x.spec.ts)')
    .option('--root <path>', '项目根目录', process.cwd())
    .option('--force', '覆盖已存在的 spec')
    .action(async (caseFile: string, cmdOpts: { out: string; root?: string; force?: boolean }) => {
      const root = path.resolve(cmdOpts.root ?? process.cwd())
      try {
        const runtime = createRuntime({ projectRoot: root })
        const opts: CompileOptions = {
          caseFile,
          out: cmdOpts.out,
          ...(cmdOpts.force ? { force: true } : {}),
        }
        const result = await runtime.compile(opts)

        for (const e of result.errors) printRuntimeError(e)

        if (result.ok) {
          const slug = path.basename(caseFile, '.md')
          printSuccess(`spec 骨架已生成:${slug}`)
          if (result.specPath) printInfo(`spec: ${result.specPath}`)
          printInfo(
            '下一步: 由编码 Agent 补全 TODO(真实选择器与断言),再执行 ' +
              `\`${result.suggestedRunCommand ?? 'auto-e2e run --spec <spec>'}\``,
          )
        }

        process.exitCode = result.ok ? 0 : 1
      } catch (err) {
        printRuntimeError(toRuntimeError(err, { code: 'compile_failed' }))
        process.exitCode = 1
      }
    })
}
