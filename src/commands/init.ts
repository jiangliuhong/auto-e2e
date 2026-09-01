import { InvalidArgumentError, type Command } from 'commander';
import { BetterWrightCli, type BetterWrightDoctorReport } from '../acceptance/betterwright-cli.js';
import { runDoctor } from '../doctor/doctor.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

export interface InitOptions extends RunOptions {
  login?: 'codex' | 'grok';
  skipAuth?: boolean;
  betterwrightBinary?: string;
}

export async function initCommand(options: InitOptions): Promise<number> {
  return runCommand(options, async (ctx) => {
    const client = new BetterWrightCli({
      binary: options.betterwrightBinary,
      cwd: ctx.projectRoot,
      logger: ctx.logger,
    });

    ctx.logger.info('正在初始化 BetterWright 浏览器环境...');
    await client.initialize();

    let report = await client.doctor();
    if (!hasModelBackend(report) && !options.skipAuth) {
      if (ctx.nonInteractive && !options.login) {
        throw new AutoE2EError(
          ExitCode.Blocked,
          '未检测到 BetterWright 模型后端。请配置模型凭据，或显式使用 `auto-e2e init --login codex`',
        );
      }
      const provider = options.login ?? 'codex';
      ctx.logger.info(`未检测到模型后端，正在启动 ${provider} 登录...`);
      await client.login(provider);
      report = await client.doctor();
    }

    const doctor = await runDoctor({
      projectRoot: ctx.projectRoot,
      scope: 'tool',
      betterwrightBinary: options.betterwrightBinary,
      logger: ctx.logger,
    });
    if (!doctor.ok) {
      const missingModel = !hasModelBackend(report);
      throw new AutoE2EError(
        ExitCode.Blocked,
        missingModel
          ? 'BetterWright 浏览器已初始化，但模型后端尚未就绪。请配置模型凭据后重新运行 `auto-e2e init`'
          : 'BetterWright 初始化后环境诊断仍未通过，请运行 `auto-e2e doctor --tool` 查看详情',
      );
    }

    return {
      exitCode: ExitCode.Ok,
      json: {
        ok: true,
        initialized: true,
        browser: report.browser ?? null,
        modelBackend: modelBackendDetail(report),
      },
      message: `auto-e2e 初始化完成：browser=${report.browser ?? 'ready'}，model=${modelBackendDetail(report) ?? 'ready'}`,
    };
  });
}

export function registerInit(program: Command): void {
  program.command('init')
    .description('初始化 auto-e2e 所需的 BetterWright 浏览器与模型后端')
    .option('--login <provider>', '无可用模型后端时登录 codex 或 grok', parseLoginProvider)
    .option('--skip-auth', '只初始化浏览器，不自动发起模型登录')
    .action(async (opts) => {
      process.exit(await initCommand(mergeGlobalOpts(opts, program) as InitOptions));
    });
}

function parseLoginProvider(value: string): 'codex' | 'grok' {
  if (value === 'codex' || value === 'grok') return value;
  throw new InvalidArgumentError('--login 只支持 codex 或 grok');
}

function hasModelBackend(report: BetterWrightDoctorReport): boolean {
  return modelBackendCheck(report)?.status === 'ok';
}

function modelBackendDetail(report: BetterWrightDoctorReport): string | null {
  return modelBackendCheck(report)?.detail ?? null;
}

function modelBackendCheck(report: BetterWrightDoctorReport) {
  return report.checks.find((check) =>
    check.group === 'Built-in agent' && check.label === 'Model backends');
}
