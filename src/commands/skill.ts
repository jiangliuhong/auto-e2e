import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

const SKILL_NAMES = ['auto-e2e-acceptance', 'auto-e2e-spec-coverage'] as const;
type SkillName = typeof SKILL_NAMES[number];

export function bundledSkillPath(name: SkillName = 'auto-e2e-acceptance'): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills', name);
}

export function installedSkillPath(projectRoot: string, name: SkillName = 'auto-e2e-acceptance'): string {
  return path.join(path.resolve(projectRoot), '.codex', 'skills', name);
}

async function skillExists(directory: string): Promise<boolean> {
  return fs.access(path.join(directory, 'SKILL.md')).then(() => true, () => false);
}

export async function installSkillCommand(opts: RunOptions & { force?: boolean }): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const plans = [];
    // 检查全部来源和目标后再复制，避免已有旧 Skill 阻止新增 Skill 安装。
    for (const name of SKILL_NAMES) {
      const source = bundledSkillPath(name);
      const target = installedSkillPath(ctx.projectRoot, name);
      if (!await skillExists(source)) {
        throw new AutoE2EError(ExitCode.ToolError, `安装包中缺少 Skill：${source}`);
      }
      const existing = await fs.lstat(target).catch((error: unknown) => {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
          return null;
        }
        throw error;
      });
      if (existing && !opts.force && !await skillExists(target)) {
        throw new AutoE2EError(
          ExitCode.ToolError,
          `Skill 目标已存在但安装不完整：${target}。如需覆盖，请使用 auto-e2e skill install --force`,
        );
      }
      const action = existing ? opts.force ? 'updated' : 'unchanged' : 'installed';
      plans.push({ name, source, path: target, action });
    }
    for (const plan of plans) {
      if (plan.action === 'unchanged') continue;
      if (opts.force) await fs.rm(plan.path, { recursive: true, force: true });
      await fs.mkdir(path.dirname(plan.path), { recursive: true });
      await fs.cp(plan.source, plan.path, { recursive: true, force: false, errorOnExist: true });
    }
    const skills = plans.map(({ name, path: target, action }) => ({ name, path: target, action }));
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, skills },
      message: skills.map((skill) => {
        const label = skill.action === 'unchanged' ? '已保留现有' : skill.action === 'updated' ? '已更新' : '已安装';
        return `${label} Codex Skill：${skill.path}`;
      }).join('\n'),
    };
  });
}

export async function skillStatusCommand(opts: RunOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const skills = await Promise.all(SKILL_NAMES.map(async (name) => {
      const target = installedSkillPath(ctx.projectRoot, name);
      return { name, installed: await skillExists(target), path: target };
    }));
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, installed: skills.every((skill) => skill.installed), skills },
      message: skills.map((skill) => skill.installed
        ? `Codex Skill 已安装：${skill.path}` : `Codex Skill 尚未安装：${skill.path}`).join('\n'),
    };
  });
}

export function registerSkill(program: Command): void {
  const skill = program.command('skill').description('在目标项目中安装或检查 auto-e2e Codex Skill');
  skill.command('install')
    .description('将随包提供的验收和覆盖率 Skill 安装到项目 .codex/skills 目录，保留已有 Skill')
    .option('--force', '更新所有随包 Skill，覆盖它们的现有内容')
    .action(async (opts) => {
      process.exit(await installSkillCommand(mergeGlobalOpts(opts, program)));
    });
  skill.command('status')
    .description('分别检查验收和覆盖率 Codex Skill 是否已安装')
    .action(async (opts) => {
      process.exit(await skillStatusCommand(mergeGlobalOpts(opts, program)));
    });
}
