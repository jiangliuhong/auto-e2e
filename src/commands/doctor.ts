import type { Command } from 'commander';
import { runDoctor, type DoctorReport, type DoctorScope } from '../doctor/doctor.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

export interface DoctorOptions extends RunOptions {
  tool?: boolean;
  project?: boolean;
  betterwrightBinary?: string;
}

export async function doctorCommand(opts: DoctorOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    if (opts.tool && opts.project) {
      throw new AutoE2EError(ExitCode.ToolError, '--tool 与 --project 不能同时使用');
    }
    const scope: DoctorScope = opts.tool ? 'tool' : opts.project ? 'project' : 'all';
    const report = await runDoctor({
      projectRoot: ctx.projectRoot,
      scope,
      betterwrightBinary: opts.betterwrightBinary,
      logger: ctx.logger,
    });
    return {
      exitCode: report.ok ? ExitCode.Ok : ExitCode.Blocked,
      json: report,
      message: formatDoctorReport(report),
    };
  });
}

export function registerDoctor(program: Command): void {
  program.command('doctor')
    .description('检查 auto-e2e 工具链和当前项目的验收运行条件')
    .option('--tool', '仅检查工具级运行环境')
    .option('--project', '仅检查当前项目')
    .action(async (opts) => {
      process.exit(await doctorCommand(mergeGlobalOpts(opts, program)));
    });
}

function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  for (const [name, title] of [['tool', 'Tool'], ['project', 'Project']] as const) {
    const group = report.groups[name];
    if (!group) continue;
    lines.push(title);
    for (const check of group.checks) {
      lines.push(`  ${statusMark(check.status)} ${check.label}: ${check.detail}`);
      if (check.fix && check.status !== 'pass') lines.push(`    修复：${check.fix}`);
    }
  }
  const summary = report.summary;
  lines.push(
    `Result: ${report.ok ? 'READY' : 'BLOCKED'} ` +
    `(pass=${summary.pass}, warn=${summary.warn}, fail=${summary.fail}, skip=${summary.skip})`,
  );
  return lines.join('\n');
}

function statusMark(status: 'pass' | 'warn' | 'fail' | 'skip'): string {
  return { pass: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'SKIP' }[status];
}
