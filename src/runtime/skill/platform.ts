// platform:把 AgentPlatform(codex/claude/zcode)映射到项目内的 skill 根目录。
// 纯函数,不读文件系统(目录存在性由 skill-reader 负责)。
// 不把任何平台目录写死进 Runtime 业务逻辑 —— 仅在此处集中维护映射,
// 便于未来新增平台或由 config 覆盖。

import path from 'node:path'
import type { AgentPlatform } from '../../core/models.js'

/** 平台 → 项目内隐藏目录名(.codex / .claude / .zcode)。 */
const PLATFORM_DIR: Record<AgentPlatform, string> = {
  codex: '.codex',
  claude: '.claude',
  zcode: '.zcode',
}

/** skill 在平台目录下的子目录名(skills)。 */
export const SKILLS_SUBDIR = 'skills'

/**
 * 返回给定平台下的 skill 根目录绝对/相对路径(相对传入的 root)。
 * 例如 root=/proj, platform=codex → /proj/.codex/skills。
 */
export function skillRootForPlatform(root: string, platform: AgentPlatform): string {
  return path.join(root, PLATFORM_DIR[platform], SKILLS_SUBDIR)
}

/**
 * 返回单个 skill 目录路径:<skill-root>/<skillName>。
 */
export function skillDir(root: string, platform: AgentPlatform, skillName: string): string {
  return path.join(skillRootForPlatform(root, platform), skillName)
}

/** SKILL.md 在 skill 目录内的固定文件名。 */
export const SKILL_MD_FILENAME = 'SKILL.md'

/** references/ 子目录名。 */
export const REFERENCES_SUBDIR = 'references'

/**
 * 把字符串归一化为 AgentPlatform;非法值返回 undefined(调用方决定默认/报错)。
 */
export function normalizeAgentPlatform(value: string | undefined): AgentPlatform | undefined {
  if (value === undefined) return undefined
  const v = value.trim().toLowerCase()
  if (v === 'codex' || v === 'claude' || v === 'zcode') return v
  return undefined
}
