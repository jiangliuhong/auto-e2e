#!/usr/bin/env node
import { Command } from 'commander';
import { registerDoctor } from './commands/doctor.js';
import { registerHistory } from './commands/history.js';
import { registerInit } from './commands/init.js';
import { registerRun } from './commands/run.js';
import { registerServe } from './commands/server.js';
import { registerSkill } from './commands/skill.js';
import { registerWorkspace } from './commands/workspace.js';

const program = new Command();

program
  .name('auto-e2e')
  .description('基于 BetterWright 的本地需求验收运行器')
  .version('0.3.1')
  .option('--json', 'JSON 模式：stdout 只输出最终 JSON')
  .option('--non-interactive', '非交互模式')
  .option('--project-root <path>', '目标项目根目录', process.cwd())
  .option('--config <path>', '项目配置路径（相对于项目根目录）')
  .option('-q, --quiet', '静默日志（等价于 --log-level warn）')
  .option('--log-level <level>', '日志级别：debug | info | warn | error | silent')
  .action(() => program.help());

registerDoctor(program);
registerInit(program);
registerRun(program);
registerHistory(program);
registerServe(program);
registerSkill(program);
registerWorkspace(program);

export { program };

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[ERROR] auto-e2e: ${message}\n`);
  process.exit(3);
});
