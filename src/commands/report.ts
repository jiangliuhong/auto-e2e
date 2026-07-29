import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import { ExitCode, AutoE2EError } from '../runtime/exit-codes.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { loadConfig } from '../config/config-loader.js';

export interface ReportOpenOptions extends RunOptions {}

export async function reportOpenCommand(opts: ReportOpenOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const htmlPath = ctx.resolve(
      path.join(config.report.outputDirectory, 'latest', 'html', 'index.html'),
    );
    const url = `file://${htmlPath}`;
    // 跨平台打开。
    const cmd =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'start'
          : 'xdg-open';
    try {
      const opener = spawn(cmd, [url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
      opener.unref();
    } catch (err) {
      throw new AutoE2EError(
        ExitCode.UnknownError,
        `无法打开报告：${err instanceof Error ? err.message : String(err)}（路径：${url}）`,
      );
    }
    const message = `已打开报告：${url}`;
    ctx.logger.info(message);
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, url },
      message,
    };
  });
}

export function registerReport(program: Command): void {
  const report = program.command('report').description('打开或查看测试报告');

  report
    .command('open')
    .description('打开 .auto-e2e/reports/latest/html/index.html')
    .action(async (opts) => {
      const code = await reportOpenCommand(mergeGlobalOpts(opts, program) as ReportOpenOptions);
      process.exit(code);
    });
}
