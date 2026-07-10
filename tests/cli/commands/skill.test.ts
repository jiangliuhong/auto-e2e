// skill 命令的 Runtime 层端到端测试(createRuntime → skillList/Validate/Generate)。
// 覆盖三平台发现、用例契约校验、用例编写指令包生成、platform 配置解析。
// 与 generate.test.ts 风格一致:tmpdir 隔离。

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { createRuntime } from '../../../src/runtime/factory.js'
import { runInit } from '../../../src/cli/commands/init.js'
import { caseBriefPath } from '../../../src/runtime/storage/paths.js'
import { configPath } from '../../../src/runtime/storage/paths.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-skill-'))
})
afterEach(async () => {
  await fse.remove(root)
})

/** 在指定平台目录下创建一个 skill(含 SKILL.md + references)。 */
async function createSkillFixture(
  platform: 'codex' | 'claude' | 'zcode',
  skillName = 'auto-e2e-case-writer',
): Promise<void> {
  const skillDir = path.join(root, `.${platform}`, 'skills', skillName)
  await fse.outputFile(
    path.join(skillDir, 'SKILL.md'),
    '---\ndescription: 写稳定的 role 定位用例\n---\n# Case Writer\n规则正文。',
  )
  await fse.outputFile(
    path.join(skillDir, 'references', 'case-schema.md'),
    '# 用例契约\n字段说明。',
  )
  await fse.outputFile(
    path.join(skillDir, 'references', 'auth-rules.md'),
    '# 鉴权规则\n使用 dev login helper。',
  )
}

/** 一个最小可扫描的 Next.js 项目 fixture(供 skillGenerate 内部自动 scan 使用)。 */
async function nextFixture(): Promise<void> {
  await fse.writeJson(path.join(root, 'package.json'), {
    name: 'demo',
    packageManager: 'pnpm@9.0.0',
    dependencies: { next: '14.0.0' },
    scripts: { dev: 'next dev' },
  })
  await fse.outputFile(
    path.join(root, 'src/app/login/page.tsx'),
    '<button data-testid="login-submit">x</button>',
  )
  await fse.outputFile(path.join(root, 'playwright.config.ts'), 'export default {}')
}

describe('runInit --agent-platform', () => {
  it('写入 agentPlatform 到 config.json', async () => {
    await runInit({ root, agentPlatform: 'claude' })
    const config = await fse.readJson(configPath(root))
    expect(config.agentPlatform).toBe('claude')
  })

  it('不指定 agentPlatform 时 config 不含该字段', async () => {
    await runInit({ root })
    const config = await fse.readJson(configPath(root))
    expect(config.agentPlatform).toBeUndefined()
  })
})

describe('DefaultRuntime.skillList', () => {
  it('默认平台 codex:发现 .codex/skills 下的 skill', async () => {
    await runInit({ root, agentPlatform: 'codex' })
    await createSkillFixture('codex')
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillList()
    expect(result.ok).toBe(true)
    expect(result.platform).toBe('codex')
    expect(result.skills.map((s) => s.name)).toEqual(['auto-e2e-case-writer'])
    expect(result.skills[0]?.description).toBe('写稳定的 role 定位用例')
    expect(result.skills[0]?.references.sort()).toEqual(['auth-rules.md', 'case-schema.md'])
  })

  it('平台 claude:发现 .claude/skills', async () => {
    await runInit({ root, agentPlatform: 'claude' })
    await createSkillFixture('claude')
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillList()
    expect(result.skills).toHaveLength(1)
    expect(result.platform).toBe('claude')
  })

  it('平台 zcode:发现 .zcode/skills', async () => {
    await runInit({ root, agentPlatform: 'zcode' })
    await createSkillFixture('zcode')
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillList()
    expect(result.skills).toHaveLength(1)
    expect(result.platform).toBe('zcode')
  })

  it('options.platform 覆盖 config', async () => {
    await runInit({ root, agentPlatform: 'codex' })
    await createSkillFixture('claude')
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillList({ platform: 'claude' })
    expect(result.platform).toBe('claude')
    expect(result.skills).toHaveLength(1)
  })

  it('skill 根不存在时返回空列表(非错误)', async () => {
    await runInit({ root })
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillList()
    expect(result.ok).toBe(true)
    expect(result.skills).toEqual([])
  })

  it('缺 config 时回退到 codex', async () => {
    // 不 init,直接调用 —— 应回退 codex 而非崩溃
    await createSkillFixture('codex')
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillList()
    expect(result.platform).toBe('codex')
    expect(result.skills).toHaveLength(1)
  })
})

describe('DefaultRuntime.skillValidate', () => {
  const validMd = `# 用例

## Target
- route: /x
- module: m
- type: readonly-smoke

## Preconditions
- app: dev server

## Steps
1. 打开页面

## Assertions
- 标题可见

## Stability Notes
- 使用 role 定位
`

  it('合法用例通过', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillValidate({ caseMarkdown: validMd })
    expect(result.ok).toBe(true)
    expect(result.testCase?.title).toBe('用例')
  })

  it('缺必填段失败', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillValidate({ caseMarkdown: '# T\n## Target\n- route: /x\n' })
    expect(result.ok).toBe(false)
  })

  it('写操作守门:含创建但无声明 → 失败', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillValidate({
      caseMarkdown: `# T
## Target
- route: /x
## Preconditions
- a
## Steps
1. 创建一条记录
## Assertions
- a
## Stability Notes
- n
`,
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'case_write_op_undeclared')).toBe(true)
  })

  it('校验 skill 存在性:不存在 → skill_not_found', async () => {
    await runInit({ root, agentPlatform: 'codex' })
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillValidate({ caseMarkdown: validMd, skill: 'missing' })
    expect(result.errors.some((e) => e.code === 'skill_not_found')).toBe(true)
  })

  it('caseFile 不存在 → 错误', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillValidate({ caseFile: '/nope.md' })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'skill_case_file_missing')).toBe(true)
  })
})

describe('DefaultRuntime.skillGenerate', () => {
  it('生成用例编写指令包,内容含 skill 规则与契约模板', async () => {
    await runInit({ root, agentPlatform: 'codex' })
    await createSkillFixture('codex')
    await nextFixture()
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.skillGenerate({
      skill: 'auto-e2e-case-writer',
      target: 'PL 参数集详情页',
      slug: 'pl-detail',
      route: '/global/pl-report/parameters?country=mx',
    })

    expect(result.ok).toBe(true)
    expect(result.briefPath).toBe(caseBriefPath(root, 'pl-detail'))
    expect(result.suggestedCasePath).toBe(
      path.join(root, 'tests', 'auto-e2e-cases', 'pl-detail', 'pl-detail.md'),
    )
    const brief = await fse.readFile(result.briefPath!, 'utf8')
    expect(brief).toContain('auto-e2e-case-writer')
    expect(brief).toContain('PL 参数集详情页')
    expect(brief).toContain('/global/pl-report/parameters?country=mx')
    expect(brief).toContain('# Case Writer')
    expect(brief).toContain('## 用例契约模板(请填写)')
    expect(brief).toContain('login-submit') // 来自自动 scan
  })

  it('skill 不存在 → skill_not_found', async () => {
    await runInit({ root })
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillGenerate({ skill: 'nope', target: 't', slug: 's' })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'skill_not_found')).toBe(true)
  })

  it('缺 target → invalid_input', async () => {
    await runInit({ root })
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillGenerate({ skill: 'x', target: '  ', slug: 's' })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'skill_generate_invalid_input')).toBe(true)
  })

  it('缺 slug → invalid_input', async () => {
    await runInit({ root })
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillGenerate({ skill: 'x', target: 't', slug: '  ' })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'skill_generate_invalid_input')).toBe(true)
  })

  it('已存在且未 force → brief_exists', async () => {
    await runInit({ root, agentPlatform: 'codex' })
    await createSkillFixture('codex')
    const runtime = createRuntime({ projectRoot: root })
    await runtime.skillGenerate({ skill: 'auto-e2e-case-writer', target: 't', slug: 's' })
    const result = await runtime.skillGenerate({
      skill: 'auto-e2e-case-writer',
      target: 't',
      slug: 's',
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'skill_generate_brief_exists')).toBe(true)
  })

  it('--force 覆盖已存在指令包', async () => {
    await runInit({ root, agentPlatform: 'codex' })
    await createSkillFixture('codex')
    const runtime = createRuntime({ projectRoot: root })
    await runtime.skillGenerate({ skill: 'auto-e2e-case-writer', target: 't', slug: 's' })
    const result = await runtime.skillGenerate({
      skill: 'auto-e2e-case-writer',
      target: 't2',
      slug: 's',
      force: true,
    })
    expect(result.ok).toBe(true)
    const brief = await fse.readFile(result.briefPath!, 'utf8')
    expect(brief).toContain('t2')
  })

  it('未跑 scan 时自动触发 scan', async () => {
    await runInit({ root, agentPlatform: 'codex' })
    await createSkillFixture('codex')
    await nextFixture()
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.skillGenerate({
      skill: 'auto-e2e-case-writer',
      target: 't',
      slug: 's',
    })
    expect(result.scanTriggered).toBe(true)
    const brief = await fse.readFile(result.briefPath!, 'utf8')
    expect(brief).toContain('## 项目上下文')
  })
})
