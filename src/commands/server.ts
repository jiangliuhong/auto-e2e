import type { Command } from 'commander';
import path from 'node:path';
import { createAutoE2EServer } from '../server/server.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

export interface ServeOptions extends RunOptions {
  port?: number | string;
  host?: string;
  open?: boolean;
  workspace?: string;
}

export async function serveCommand(opts: ServeOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const port = opts.port ? Number(opts.port) : 4317;
    const host = opts.host ?? '127.0.0.1';
    const instance = createAutoE2EServer({
      projectRoot: opts.workspace ? path.resolve(ctx.projectRoot, opts.workspace) : ctx.projectRoot,
      registerProjectRoot: Boolean(opts.workspace || opts.config),
      configPath: opts.config,
      port,
      host,
      logger: ctx.logger,
    });
    await instance.start();
    if (opts.open) await openUrl(instance.url).catch(() => undefined);
    if (ctx.nonInteractive) {
      await instance.stop();
      return {
        exitCode: ExitCode.Ok,
        json: { ok: true, url: instance.url },
        message: `服务检查通过：${instance.url}`,
      };
    }
    await waitForShutdown(instance.stop, ctx.logger);
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, url: instance.url },
      message: `服务已停止：${instance.url}`,
    };
  });
}

export function registerServe(program: Command): void {
  program.command('serve')
    .description('启动本地验收历史与报告服务')
    .option('-p, --port <number>', '监听端口', '4317')
    .option('-H, --host <host>', '绑定地址', '127.0.0.1')
    .option('--open', '启动后打开浏览器')
    .option('--workspace <path>', '启动时注册一个工作区')
    .action(async (opts) => {
      process.exit(await serveCommand(mergeGlobalOpts(opts, program) as ServeOptions));
    });
}

async function waitForShutdown(stop: () => Promise<void>, logger: { info(message: string): void }): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      process.removeListener('SIGINT', shutdown);
      process.removeListener('SIGTERM', shutdown);
      logger.info('正在关闭报告服务...');
      await stop();
      resolve();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}

async function openUrl(url: string): Promise<void> {
  const { spawn } = await import('node:child_process');
  const command = process.platform === 'darwin'
    ? { file: 'open', args: [url] }
    : process.platform === 'win32'
      ? { file: 'cmd', args: ['/c', 'start', '', url] }
      : { file: 'xdg-open', args: [url] };
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.file, command.args, { detached: true, stdio: 'ignore', shell: false });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
