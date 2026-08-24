import type { Command } from 'commander';
import { ExitCode } from '../runtime/exit-codes.js';
import type { RunOptions, CommandResult } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { describeTaskSpec, type SpecDescription } from '../agent/spec-describer.js';

export interface SpecSchemaOptions extends RunOptions {}

/**
 * `auto-e2e spec schema`：输出 task-spec.json 的权威字段规范。
 *
 * 规范从 TaskSpecSchema（Zod）反射生成，保证与代码同源。
 * 自动化调用方可用 `--json` 获取机器可读结构。
 */
export async function specSchemaCommand(opts: SpecSchemaOptions): Promise<number> {
  return runCommand<SpecSchemaResult>(opts, async (ctx) => {
    const spec = describeTaskSpec();

    if (!ctx.json) {
      // 人类可读：字段表格输出到日志（stderr）。
      ctx.logger.info(`task-spec.json 规范（默认路径：${spec.defaultPath}）`);
      ctx.logger.info('');
      ctx.logger.info('字段：');
      const rows = spec.fields.map(
        (f) =>
          `  ${f.name.padEnd(20)} ${f.type.padEnd(9)} ${f.required ? '必填' : '可选'}  ${f.description}`,
      );
      for (const row of rows) {
        ctx.logger.info(row);
      }
    }

    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, ...spec },
    } satisfies CommandResult<SpecSchemaResult>;
  });
}

interface SpecSchemaResult extends SpecDescription {
  ok: boolean;
}

export function registerSpec(program: Command): void {
  const spec = program.command('spec').description('task-spec.json 规范与工具');

  spec
    .command('schema')
    .description('输出 task-spec.json 的字段规范（从 Zod schema 反射，供自动化调用方读取）')
    .action(async (opts) => {
      const code = await specSchemaCommand(mergeGlobalOpts(opts, program) as SpecSchemaOptions);
      process.exit(code);
    });
}
