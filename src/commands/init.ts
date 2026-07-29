import type { Command } from 'commander';
import { ExitCode, AutoE2EError } from '../runtime/exit-codes.js';
import type { RunOptions, CommandResult } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { defaultConfig } from '../config/defaults.js';
import { writeInitArtifacts } from '../config/config-writer.js';

export interface InitOptions extends RunOptions {
  force?: boolean;
}

export async function initCommand(opts: InitOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const config = defaultConfig();
    try {
      const artifact = await writeInitArtifacts({
        projectRoot: ctx.projectRoot,
        config,
        force: opts.force,
      });
      const message = [
        `已初始化 auto-e2e：`,
        `  配置: ${artifact.configPath}`,
        `  示例 task-spec: ${artifact.taskSpecPath}`,
        artifact.gitignoreUpdated ? '  已更新 .gitignore' : '  .gitignore 已包含必要条目',
      ].join('\n');
      ctx.logger.info(message);
      const result: CommandResult<{ ok: boolean; configPath: string; taskSpecPath: string }> = {
        exitCode: ExitCode.Ok,
        json: {
          ok: true,
          configPath: artifact.configPath,
          taskSpecPath: artifact.taskSpecPath,
        },
        message,
      };
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 配置文件已存在视为配置错误（退出码 7）。
      throw new AutoE2EError(ExitCode.ConfigError, message);
    }
  });
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('在当前项目初始化 auto-e2e 配置与目录结构')
    .option('--force', '覆盖已存在的配置文件')
    .action(async (opts) => {
      const code = await initCommand(mergeGlobalOpts(opts, program) as InitOptions);
      process.exit(code);
    });
}
