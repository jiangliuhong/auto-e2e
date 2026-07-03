// `auto-e2e init` 命令。
// 在 cwd 创建 .auto-e2e/ 完整布局并写入默认 config.json。幂等。
// 严格委托 Storage 与 config 层,CLI 不含业务逻辑。

import path from 'node:path'
import { Command } from 'commander'
import { FsStorageService } from '../../runtime/storage/fs-storage.js'
import { configPath } from '../../runtime/storage/paths.js'
import { defaultConfig, parseConfig } from '../../runtime/config.js'
import { toRuntimeError } from '../../utils/errors.js'
import { printInfo, printRuntimeError, printSuccess } from '../output.js'
import type { RuntimeError } from '../../core/errors.js'

export interface InitOptions {
  /** 项目根目录,默认 cwd。 */
  root?: string
  /** 强制覆盖已有 config.json。 */
  force?: boolean
}

export interface InitOutcome {
  ok: boolean
  configPath: string
  created: string[]
  errors: RuntimeError[]
}

/** 执行 init 的核心逻辑(可被测试直接调用,不依赖 commander)。 */
export async function runInit(opts: InitOptions = {}): Promise<InitOutcome> {
  const root = path.resolve(opts.root ?? process.cwd())
  const storage = new FsStorageService(root)
  const created: string[] = []
  const errors: RuntimeError[] = []

  try {
    await storage.ensureLayout()
    created.push('.auto-e2e/')

    const relConfig = '.auto-e2e/config.json'
    const exists = await storage.exists(relConfig)
    if (exists && !opts.force) {
      // 已存在则保留用户配置,不覆盖。
      return { ok: true, configPath: configPath(root), created, errors }
    }

    const config = defaultConfig()
    parseConfig(config) // 写入前自校验,确保默认值合法
    await storage.writeJson(relConfig, config)
    created.push(relConfig)
  } catch (err) {
    errors.push(toRuntimeError(err, { code: 'init_failed' }))
  }

  return { ok: errors.length === 0, configPath: configPath(root), created, errors }
}

export function makeInitCommand(): Command {
  return new Command('init')
    .description('初始化 .auto-e2e/ 目录与默认 config.json')
    .option('--root <path>', '项目根目录', process.cwd())
    .option('--force', '覆盖已存在的 config.json')
    .action(async (cmdOpts: { root?: string; force?: boolean }) => {
      const result = await runInit({ root: cmdOpts.root, force: cmdOpts.force })
      for (const e of result.errors) printRuntimeError(e)
      for (const f of result.created) printSuccess(`已创建 ${f}`)
      printInfo(`config: ${result.configPath}`)
      process.exitCode = result.ok ? 0 : 1
    })
}
