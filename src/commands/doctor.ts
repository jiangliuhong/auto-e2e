import type { Command } from 'commander';
import { BetterWrightCli } from '../acceptance/betterwright-cli.js';
import { ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

export async function doctorCommand(opts: RunOptions & { betterwrightBinary?: string }): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const doctor = await new BetterWrightCli({
      binary: opts.betterwrightBinary,
      cwd: ctx.projectRoot,
      logger: ctx.logger,
    }).doctor();
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, betterwright: doctor },
      message: 'BetterWright 环境已就绪',
    };
  });
}

export function registerDoctor(program: Command): void {
  program.command('doctor')
    .description('检查 BetterWright 验收运行环境')
    .action(async (opts) => {
      process.exit(await doctorCommand(mergeGlobalOpts(opts, program)));
    });
}
