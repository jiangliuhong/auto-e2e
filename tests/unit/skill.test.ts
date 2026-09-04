import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installSkillCommand,
  bundledSkillPath,
  installedSkillPath,
  skillStatusCommand,
} from '../../src/commands/skill.js';

describe('project-local Codex Skill', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-skill-'));
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('把两个 Skill 及其资源安装到目标项目，并输出一个最终 JSON', async () => {
    const target = installedSkillPath(projectRoot);
    expect(target).toBe(path.join(projectRoot, '.codex', 'skills', 'auto-e2e-acceptance'));

    expect(await installSkillCommand({ projectRoot, json: true })).toBe(0);
    expect(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8')).toContain('name: auto-e2e-acceptance');
    expect(await fs.readFile(path.join(target, 'references', 'authoring-review.md'), 'utf8')).toBe(
      await fs.readFile(path.join(bundledSkillPath(), 'references', 'authoring-review.md'), 'utf8'),
    );
    const coverage = installedSkillPath(projectRoot, 'auto-e2e-spec-coverage');
    expect(coverage).toBe(path.join(projectRoot, '.codex', 'skills', 'auto-e2e-spec-coverage'));
    for (const resource of ['SKILL.md', 'agents/openai.yaml', 'assets/review.yaml', 'references/review-format.md']) {
      expect(await fs.readFile(path.join(coverage, resource), 'utf8')).toBe(
        await fs.readFile(path.join(bundledSkillPath('auto-e2e-spec-coverage'), resource), 'utf8'),
      );
    }
    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    expect(process.stdout.write).toHaveBeenLastCalledWith(JSON.stringify({
      ok: true,
      skills: [
        { name: 'auto-e2e-acceptance', path: target, action: 'installed' },
        { name: 'auto-e2e-spec-coverage', path: coverage, action: 'installed' },
      ],
    }, null, 2) + '\n');
    expect(await skillStatusCommand({ projectRoot, json: true })).toBe(0);
    expect(process.stdout.write).toHaveBeenLastCalledWith(JSON.stringify({
      ok: true,
      installed: true,
      skills: [
        { name: 'auto-e2e-acceptance', installed: true, path: target },
        { name: 'auto-e2e-spec-coverage', installed: true, path: coverage },
      ],
    }, null, 2) + '\n');
  });

  it('旧项目保留已修改的验收 Skill，同时补装覆盖率 Skill', async () => {
    const target = installedSkillPath(projectRoot);
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'SKILL.md'), 'project-specific acceptance');
    expect(await installSkillCommand({ projectRoot, json: true })).toBe(0);
    expect(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8')).toBe('project-specific acceptance');
    expect(await fs.readFile(path.join(installedSkillPath(projectRoot, 'auto-e2e-spec-coverage'), 'SKILL.md'), 'utf8'))
      .toContain('name: auto-e2e-spec-coverage');
    expect(process.stdout.write).toHaveBeenLastCalledWith(expect.stringContaining('"action": "unchanged"'));
    expect(await installSkillCommand({ projectRoot })).toBe(0);
    expect(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8')).toBe('project-specific acceptance');
  });

  it('force 更新两个随包 Skill 并删除旧资源，保留其他项目 Skill', async () => {
    expect(await installSkillCommand({ projectRoot })).toBe(0);
    const names = ['auto-e2e-acceptance', 'auto-e2e-spec-coverage'] as const;
    for (const name of names) {
      const target = installedSkillPath(projectRoot, name);
      await fs.writeFile(path.join(target, 'SKILL.md'), 'local changes');
      await fs.writeFile(path.join(target, 'obsolete.md'), 'obsolete');
    }
    const unrelated = path.join(projectRoot, '.codex', 'skills', 'custom', 'SKILL.md');
    await fs.mkdir(path.dirname(unrelated), { recursive: true });
    await fs.writeFile(unrelated, 'keep me');
    expect(await installSkillCommand({ projectRoot, force: true, json: true })).toBe(0);
    for (const name of names) {
      const target = installedSkillPath(projectRoot, name);
      expect(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8')).toBe(
        await fs.readFile(path.join(bundledSkillPath(name), 'SKILL.md'), 'utf8'),
      );
      await expect(fs.access(path.join(target, 'obsolete.md'))).rejects.toThrow();
    }
    expect(await fs.readFile(unrelated, 'utf8')).toBe('keep me');
    expect(process.stdout.write).toHaveBeenLastCalledWith(expect.stringContaining('"action": "updated"'));
  });

  it.each([false, true])('状态分别报告缺失 Skill（已有验收 Skill：%s），且不写入项目', async (acceptanceInstalled) => {
    const target = installedSkillPath(projectRoot);
    if (acceptanceInstalled) {
      await fs.mkdir(target, { recursive: true });
      await fs.writeFile(path.join(target, 'SKILL.md'), 'existing acceptance');
    }
    expect(await skillStatusCommand({ projectRoot, json: true })).toBe(0);
    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    expect(process.stdout.write).toHaveBeenLastCalledWith(JSON.stringify({
      ok: true,
      installed: false,
      skills: [
        { name: 'auto-e2e-acceptance', installed: acceptanceInstalled, path: target },
        { name: 'auto-e2e-spec-coverage', installed: false, path: installedSkillPath(projectRoot, 'auto-e2e-spec-coverage') },
      ],
    }, null, 2) + '\n');
    await expect(fs.access(installedSkillPath(projectRoot, 'auto-e2e-spec-coverage'))).rejects.toThrow();
  });

  it('不覆盖不完整的目标，预检失败时也不先安装其他 Skill', async () => {
    const target = installedSkillPath(projectRoot, 'auto-e2e-spec-coverage');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'notes.md'), 'keep this');
    expect(await installSkillCommand({ projectRoot, json: true })).toBe(3);
    expect(await fs.readFile(path.join(target, 'notes.md'), 'utf8')).toBe('keep this');
    await expect(fs.access(installedSkillPath(projectRoot))).rejects.toThrow();
    expect(await installSkillCommand({ projectRoot, force: true })).toBe(0);
    expect(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8')).toContain('name: auto-e2e-spec-coverage');
  });
});
