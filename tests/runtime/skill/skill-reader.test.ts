// platform + skill-reader 测试。
// platform 为纯函数;skill-reader 用 tmpdir 隔离文件系统。

import { describe, expect, it } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import fse from 'fs-extra'
import {
  normalizeAgentPlatform,
  skillDir,
  skillRootForPlatform,
} from '../../../src/runtime/skill/platform.js'
import {
  parseSkillFrontmatter,
  readSkills,
  readSkillContent,
} from '../../../src/runtime/skill/skill-reader.js'

describe('platform (纯函数)', () => {
  it('skillRootForPlatform 映射平台到 .codex/.claude/.zcode/skills', () => {
    expect(skillRootForPlatform('/proj', 'codex')).toBe(path.join('/proj', '.codex', 'skills'))
    expect(skillRootForPlatform('/proj', 'claude')).toBe(path.join('/proj', '.claude', 'skills'))
    expect(skillRootForPlatform('/proj', 'zcode')).toBe(path.join('/proj', '.zcode', 'skills'))
  })

  it('skillDir 拼接 skill 名', () => {
    expect(skillDir('/proj', 'codex', 'my-skill')).toBe(
      path.join('/proj', '.codex', 'skills', 'my-skill'),
    )
  })

  it('normalizeAgentPlatform 归一化大小写', () => {
    expect(normalizeAgentPlatform('CODEX')).toBe('codex')
    expect(normalizeAgentPlatform('Claude')).toBe('claude')
    expect(normalizeAgentPlatform('ZCode')).toBe('zcode')
  })

  it('normalizeAgentPlatform 非法值返回 undefined', () => {
    expect(normalizeAgentPlatform('foo')).toBeUndefined()
    expect(normalizeAgentPlatform(undefined)).toBeUndefined()
  })
})

describe('parseSkillFrontmatter (纯函数)', () => {
  it('解析 frontmatter description 与正文', () => {
    const md = `---
description: 这是一个测试 skill
---

# My Skill

正文内容。
`
    const { description, body } = parseSkillFrontmatter(md)
    expect(description).toBe('这是一个测试 skill')
    expect(body).toContain('# My Skill')
    expect(body).toContain('正文内容。')
  })

  it('去引号', () => {
    const { description } = parseSkillFrontmatter('---\ndescription: "带引号"\n---\nbody')
    expect(description).toBe('带引号')
  })

  it('无 frontmatter 时 description 为 undefined,body 为原文', () => {
    const { description, body } = parseSkillFrontmatter('# 无 fm\nbody')
    expect(description).toBeUndefined()
    expect(body).toBe('# 无 fm\nbody')
  })
})

describe('readSkills (tmpdir 隔离)', () => {
  it('skill 根不存在时返回空列表(非错误)', async () => {
    const root = await fse.mkdtemp(path.join(os.tmpdir(), 'ae2e-skill-'))
    try {
      const result = await readSkills(path.join(root, '.codex', 'skills'))
      expect(result.skills).toEqual([])
      expect(result.errors).toEqual([])
    } finally {
      await fse.remove(root)
    }
  })

  it('发现多个 skill 并解析 frontmatter', async () => {
    const root = await fse.mkdtemp(path.join(os.tmpdir(), 'ae2e-skill-'))
    try {
      const skillRoot = path.join(root, '.codex', 'skills')
      await fse.outputFile(
        path.join(skillRoot, 'alpha', 'SKILL.md'),
        '---\ndescription: alpha skill\n---\n# Alpha\n',
      )
      await fse.outputFile(
        path.join(skillRoot, 'beta', 'SKILL.md'),
        '---\ndescription: beta skill\n---\n# Beta\n',
      )
      const result = await readSkills(skillRoot)
      expect(result.errors).toEqual([])
      expect(result.skills.map((s) => s.name)).toEqual(['alpha', 'beta'])
      expect(result.skills[0]?.description).toBe('alpha skill')
      expect(result.skills[0]?.path).toBe(path.join(skillRoot, 'alpha', 'SKILL.md'))
    } finally {
      await fse.remove(root)
    }
  })

  it('列出 references/*.md', async () => {
    const root = await fse.mkdtemp(path.join(os.tmpdir(), 'ae2e-skill-'))
    try {
      const skillsDir = path.join(root, '.claude', 'skills')
      const skillDirAbs = path.join(skillsDir, 'case-writer')
      await fse.outputFile(path.join(skillDirAbs, 'SKILL.md'), '# Writer\n')
      await fse.outputFile(path.join(skillDirAbs, 'references', 'case-schema.md'), 'schema')
      await fse.outputFile(path.join(skillDirAbs, 'references', 'auth-rules.md'), 'auth')
      await fse.outputFile(path.join(skillDirAbs, 'references', 'notes.txt'), 'ignored') // 非 .md
      const result = await readSkills(skillsDir)
      expect(result.skills).toHaveLength(1)
      expect(result.skills[0]?.references.sort()).toEqual(['auth-rules.md', 'case-schema.md'])
    } finally {
      await fse.remove(root)
    }
  })

  it('无 SKILL.md 的目录被跳过(非错误)', async () => {
    const root = await fse.mkdtemp(path.join(os.tmpdir(), 'ae2e-skill-'))
    try {
      const skillRoot = path.join(root, '.zcode', 'skills')
      await fse.outputFile(path.join(skillRoot, 'empty', 'README.md'), 'no skill md')
      await fse.outputFile(path.join(skillRoot, 'real', 'SKILL.md'), '# Real\n')
      const result = await readSkills(skillRoot)
      expect(result.skills.map((s) => s.name)).toEqual(['real'])
      expect(result.errors).toEqual([])
    } finally {
      await fse.remove(root)
    }
  })
})

describe('readSkillContent (tmpdir 隔离)', () => {
  it('读取 SKILL.md 正文 + references 内容', async () => {
    const root = await fse.mkdtemp(path.join(os.tmpdir(), 'ae2e-skill-'))
    try {
      const skillsDir = path.join(root, '.codex', 'skills')
      const skillDirAbs = path.join(skillsDir, 'writer')
      await fse.outputFile(path.join(skillDirAbs, 'SKILL.md'), '# Writer\n正文')
      await fse.outputFile(path.join(skillDirAbs, 'references', 'rules.md'), '规则正文')
      const content = await readSkillContent(skillsDir, 'writer')
      expect(content).toBeDefined()
      expect(content?.skillMarkdown).toContain('# Writer')
      expect(content?.references['rules.md']).toBe('规则正文')
    } finally {
      await fse.remove(root)
    }
  })

  it('skill 不存在时返回 undefined', async () => {
    const root = await fse.mkdtemp(path.join(os.tmpdir(), 'ae2e-skill-'))
    try {
      const content = await readSkillContent(path.join(root, '.codex', 'skills'), 'missing')
      expect(content).toBeUndefined()
    } finally {
      await fse.remove(root)
    }
  })
})
