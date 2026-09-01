import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

const SKILL_NAME = 'auto-e2e-acceptance';

export function bundledSkillPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills', SKILL_NAME);
}

export function installedSkillPath(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), '.codex', 'skills', SKILL_NAME);
}

async function skillExists(directory: string): Promise<boolean> {
  return fs.access(path.join(directory, 'SKILL.md')).then(() => true, () => false);
}

export async function installSkillCommand(opts: RunOptions & { force?: boolean }): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const source = bundledSkillPath();
    const target = installedSkillPath(ctx.projectRoot);
    if (!await skillExists(source)) {
      throw new AutoE2EError(ExitCode.ToolError, `安装包中缺少 Skill：${source}`);
    }
    if (await skillExists(target) && !opts.force) {
      throw new AutoE2EError(
        ExitCode.ToolError,
        `Skill 已存在：${target}。如需覆盖，请使用 auto-e2e skill install --force`,
      );
    }
    if (opts.force) await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, { recursive: true, force: true });
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, name: SKILL_NAME, path: target },
      message: `已安装 Codex Skill：${target}`,
    };
  });
}

export async function skillStatusCommand(opts: RunOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const target = installedSkillPath(ctx.projectRoot);
    const installed = await skillExists(target);
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, name: SKILL_NAME, installed, path: target },
      message: installed ? `Codex Skill 已安装：${target}` : `Codex Skill 尚未安装：${target}`,
    };
  });
}

export function registerSkill(program: Command): void {
  const skill = program.command('skill').description('在目标项目中安装或检查 auto-e2e Codex Skill');
  skill.command('install')
    .description('将随包提供的 Skill 安装到项目 .codex/skills 目录')
    .option('--force', '覆盖现有 Skill')
    .action(async (opts) => {
      process.exit(await installSkillCommand(mergeGlobalOpts(opts, program)));
    });
  skill.command('status')
    .description('检查 Codex Skill 是否已安装')
    .action(async (opts) => {
      process.exit(await skillStatusCommand(mergeGlobalOpts(opts, program)));
    });
}
