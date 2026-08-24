import type { Command } from 'commander';
import { ExitCode } from '../runtime/exit-codes.js';
import type { RunOptions, CommandResult } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { loadConfig } from '../config/config-loader.js';

export interface ConfigShowOptions extends RunOptions {}

export async function configShowCommand(opts: ConfigShowOptions): Promise<number> {
  return runCommand<ConfigShowResult>(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const configPath = ctx.resolve('.auto-e2e/config.yaml');

    // 非 JSON 模式：人类可读输出。配置文件本身不含敏感信息（plan §18 禁止）。
    if (!ctx.json) {
      ctx.logger.info(`配置文件：${configPath}`);
      ctx.logger.info(`项目：${config.project.name}（${config.project.baseUrl}）`);
      ctx.logger.info(
        config.project.manageApplication
          ? `启动命令：${config.project.startCommand}`
          : '应用管理：外部托管（跳过本地启动和健康检查）',
      );
      ctx.logger.info(
        `Agent：${config.agent.implementation} / ${config.agent.provider}`,
      );
      ctx.logger.info(
        `浏览器：${config.browser.explorer}（${config.browser.implementation}，${config.browser.browser}）`,
      );
      ctx.logger.info(
        `Playwright：retries=${config.playwright.retries} workers=${config.playwright.workers}`,
      );
      ctx.logger.info(`报告格式：${config.report.formats.join(', ')}`);
    }

    return {
      exitCode: ExitCode.Ok,
      json: {
        ok: true,
        configPath,
        config,
      },
      message: undefined,
    } satisfies CommandResult<ConfigShowResult>;
  });
}

interface ConfigShowResult {
  ok: boolean;
  configPath: string;
  config: unknown;
}

export function registerConfig(program: Command): void {
  const config = program.command('config').description('查看 auto-e2e 配置');

  config
    .command('show')
    .description('打印当前生效的配置（默认 / config.yaml / 环境变量合并结果）')
    .action(async (opts) => {
      const code = await configShowCommand(mergeGlobalOpts(opts, program) as ConfigShowOptions);
      process.exit(code);
    });
}
