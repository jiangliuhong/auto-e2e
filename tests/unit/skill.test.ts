import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installSkillCommand,
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

  it('把 Skill 安装到目标项目而不是用户目录', async () => {
    const target = installedSkillPath(projectRoot);
    expect(target).toBe(path.join(projectRoot, '.codex', 'skills', 'auto-e2e-acceptance'));

    expect(await installSkillCommand({ projectRoot })).toBe(0);
    expect(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8')).toContain('name: auto-e2e-acceptance');
    expect(await skillStatusCommand({ projectRoot, json: true })).toBe(0);

    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining(`"path": "${target}"`));
  });

  it('已安装时要求显式使用 force', async () => {
    expect(await installSkillCommand({ projectRoot })).toBe(0);
    expect(await installSkillCommand({ projectRoot })).toBe(3);
    expect(await installSkillCommand({ projectRoot, force: true })).toBe(0);
  });
});
