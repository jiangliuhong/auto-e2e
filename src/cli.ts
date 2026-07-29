#!/usr/bin/env node
/**
 * auto-e2e CLI 入口。
 *
 * 全局选项（plan §14）：
 *   --json              JSON 模式：stdout 只输出最终 JSON
 *   --non-interactive   非交互模式：禁止等待用户输入
 *   --project-root      目标项目根目录（默认 process.cwd()）
 *   -q, --quiet         静默日志
 *   --log-level         debug | info | warn | error | silent
 */
import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { registerAuth } from './commands/auth.js';
import { registerGenerate } from './commands/generate.js';
import { registerVerify } from './commands/verify.js';
import { registerRun } from './commands/run.js';
import { registerAnalyze } from './commands/analyze.js';
import { registerReport } from './commands/report.js';
import { registerConfig } from './commands/config.js';
import { registerSpec } from './commands/spec.js';

const program = new Command();

program
  .name('auto-e2e')
  .description('基于 Pi + BetterWright + Playwright 的自动化 E2E 测试生成与执行 CLI')
  .version('0.1.0')
  .option('--json', 'JSON 模式：stdout 只输出最终 JSON')
  .option('--non-interactive', '非交互模式：禁止等待用户输入')
  .option('--project-root <path>', '目标项目根目录', process.cwd())
  .option('-q, --quiet', '静默日志（等价于 --log-level warn）')
  .option(
    '--log-level <level>',
    '日志级别：debug | info | warn | error | silent',
  );

registerInit(program);
registerAuth(program);
registerGenerate(program);
registerVerify(program);
registerRun(program);
registerAnalyze(program);
registerReport(program);
registerConfig(program);
registerSpec(program);

export { mergeGlobalOpts } from './runtime/global-options.js';
export { program };

program.parseAsync(process.argv).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[ERROR] auto-e2e: ${message}\n`);
  process.exit(9);
});
