// auto-e2e CLI 主入口。
// 仅编排:解析参数 → 调用 Runtime / 各命令核心逻辑 → 输出 → 设置退出码。
// 业务逻辑不放在 CLI(对齐 ARCHITECTURE.md「CLI 只应编排 Runtime API」)。

import { Command } from 'commander'
import { makeInitCommand } from './commands/init.js'
import { makeDoctorCommand } from './commands/doctor.js'
import { makeScanCommand } from './commands/scan.js'
import { makePrepareCommand } from './commands/prepare.js'
import { makeGenerateCommand } from './commands/generate.js'
import { makeRunCommand } from './commands/run.js'
import { makeSkillCommand } from './commands/skill.js'
import { makeCompileCommand } from './commands/compile.js'
import { printRuntimeError } from './output.js'
import { toRuntimeError } from '../utils/errors.js'

function createProgram(): Command {
  const program = new Command()
  program
    .name('auto-e2e')
    .description('面向 Playwright 的 Agent Runtime — 环境 / 观察 / 执行 / 反馈')
    .version('0.1.0')

  program.addCommand(makeInitCommand())
  program.addCommand(makeDoctorCommand())
  program.addCommand(makeScanCommand())
  program.addCommand(makePrepareCommand())
  program.addCommand(makeGenerateCommand())
  program.addCommand(makeRunCommand())
  program.addCommand(makeSkillCommand())
  program.addCommand(makeCompileCommand())

  return program
}

/**
 * 运行 CLI。
 * @param argv 参数(默认 process.argv 的后两段)。
 * 返回退出码,便于测试;实际进程退出由 main 完成。
 */
export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const program = createProgram()
  try {
    await program.parseAsync(argv, { from: 'user' })
    return Number(process.exitCode ?? 0)
  } catch (err) {
    printRuntimeError(toRuntimeError(err, { code: 'cli_error' }))
    return 1
  }
}

// 当作为 bin 入口直接运行时执行。
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().then((code) => {
    process.exitCode = code
  })
}
