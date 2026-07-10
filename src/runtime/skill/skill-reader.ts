// skill-reader:扫描 <skill-root>/<name>/SKILL.md,解析 frontmatter,
// 返回 SkillDescriptor[]。文件系统操作集中于此;解析为纯函数风格。
// 对齐 ARCHITECTURE.md「保持职责隔离」:发现与读取 skill,不做校验、不做渲染。
//
// frontmatter 采用极简 YAML 子集(--- 分隔,`key: value` 行),不引入三方依赖。
// 这与 case-contract.ts 的零依赖 Markdown 处理哲学一致。

import fse from 'fs-extra'
import path from 'node:path'
import type { SkillDescriptor } from '../../core/models.js'
import { REFERENCES_SUBDIR, SKILL_MD_FILENAME } from './platform.js'
import { toRuntimeError } from '../../utils/errors.js'
import type { RuntimeError } from '../../core/errors.js'

/** skill-reader 的返回结果。 */
export interface SkillReaderResult {
  skills: SkillDescriptor[]
  errors: RuntimeError[]
}

/**
 * 扫描 skill 根目录,发现所有合法 skill。
 * skill 根目录不存在时不视为错误(返回空列表);读取 SKILL.md 失败才记入 errors。
 */
export async function readSkills(skillRoot: string): Promise<SkillReaderResult> {
  const skills: SkillDescriptor[] = []
  const errors: RuntimeError[] = []

  const rootExists = await fse.pathExists(skillRoot)
  if (!rootExists) {
    return { skills, errors }
  }

  let entries: import('node:fs').Dirent[]
  try {
    entries = await fse.readdir(skillRoot, { withFileTypes: true })
  } catch (err) {
    errors.push(toRuntimeError(err, { code: 'skill_read_failed' }))
    return { skills, errors }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillName = entry.name
    const skillDirAbs = path.join(skillRoot, skillName)
    const skillMdAbs = path.join(skillDirAbs, SKILL_MD_FILENAME)
    const mdExists = await fse.pathExists(skillMdAbs)
    if (!mdExists) continue // 无 SKILL.md 的目录跳过(不是错误)

    try {
      const content = await fse.readFile(skillMdAbs, 'utf8')
      const references = await readReferenceFiles(skillDirAbs)
      const { description } = parseSkillFrontmatter(content)
      skills.push({
        name: skillName,
        path: skillMdAbs,
        ...(description !== undefined ? { description } : {}),
        references,
      })
    } catch (err) {
      errors.push(
        toRuntimeError(err, {
          code: 'skill_read_failed',
          details: { skill: skillName },
        }),
      )
    }
  }

  // 名字稳定排序,保证输出确定性。
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return { skills, errors }
}

/**
 * 读取单个 skill 的全部内容:SKILL.md 正文 + references/*.md。
 * 返回 skill 正文、references 映射(文件名 → 正文);skill 不存在时返回 undefined。
 */
export async function readSkillContent(
  skillRoot: string,
  skillName: string,
): Promise<{ skillMarkdown: string; references: Record<string, string> } | undefined> {
  const skillDirAbs = path.join(skillRoot, skillName)
  const skillMdAbs = path.join(skillDirAbs, SKILL_MD_FILENAME)
  const mdExists = await fse.pathExists(skillMdAbs)
  if (!mdExists) return undefined

  const skillMarkdown = await fse.readFile(skillMdAbs, 'utf8')
  const refNames = await readReferenceFiles(skillDirAbs)
  const references: Record<string, string> = {}
  for (const refName of refNames) {
    const refPath = path.join(skillDirAbs, REFERENCES_SUBDIR, refName)
    references[refName] = await fse.readFile(refPath, 'utf8')
  }
  return { skillMarkdown, references }
}

/** 列出 references/ 目录下的 .md 文件名(不含路径)。 */
async function readReferenceFiles(skillDirAbs: string): Promise<string[]> {
  const refDir = path.join(skillDirAbs, REFERENCES_SUBDIR)
  const refExists = await fse.pathExists(refDir)
  if (!refExists) return []
  const entries = await fse.readdir(refDir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort()
}

/**
 * 解析极简 YAML frontmatter(--- 分隔块)。
 * 仅提取 description 字段(其它字段暂不消费)。无 frontmatter 时返回 undefined。
 * 去掉 frontmatter 后的正文留给调用方按需处理。
 */
export function parseSkillFrontmatter(content: string): {
  description?: string
  body: string
} {
  const fmMatch = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(content)
  if (!fmMatch || !fmMatch[1]) {
    return { body: content }
  }
  const fmBody = fmMatch[1]
  const restBody = fmMatch[2] ?? ''
  const description = extractYamlValue(fmBody, 'description')
  return {
    ...(description !== undefined ? { description } : {}),
    body: restBody,
  }
}

/** 从极简 YAML 文本中提取指定键的值(单行 `key: value`)。 */
function extractYamlValue(yaml: string, key: string): string | undefined {
  const re = new RegExp(`^${key}\\s*:\\s*(.+?)\\s*$`, 'mi')
  const m = re.exec(yaml)
  if (!m || !m[1]) return undefined
  // 去掉首尾引号
  return m[1].replace(/^["']|["']$/g, '').trim()
}
