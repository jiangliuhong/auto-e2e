// `auto-e2e skill` 命令(含 list / validate / generate 三个子命令)。
// 读取项目 skill(.codex / .claude / .zcode/skills/),支持用例契约校验与用例编写指令包生成。
// CLI 仅编排:解析参数 → 调用 Runtime 的 skillList/skillValidate/skillGenerate → 输出 → 设置退出码。
// 业务逻辑不进 CLI(对齐 ARCHITECTURE.md)。
//
// --project 作为 --root 的别名(与项目内其他命令的 --root 一致),仅 skill 命令暴露该别名。

import path from 'node:path'
import { Command } from 'commander'
import { createRuntime } from '../../runtime/factory.js'
import { printInfo, printRuntimeError, printSuccess } from '../output.js'
import { toRuntimeError } from '../../utils/errors.js'
import type { AgentPlatform } from '../../core/models.js'
import type {
  SkillGenerateOptions,
  SkillListOptions,
  SkillValidateOptions,
} from '../../core/index.js'
import { normalizeAgentPlatform } from '../../runtime/skill/platform.js'

/**
 * 从 target 派生 slug:取 ASCII 字母数字与连字符,中文/标点降级为 hash 后缀。
 * 派生仅为默认值;建议显式 --slug 提供稳定可读名。
 */
function deriveSlugFromTarget(target: string): string {
  // 尝试提取 ASCII slug。
  const ascii = target
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length <= 60) return ascii
  // ASCII 不足时用简易 hash 保证稳定且唯一。
  const hash = Array.from(target).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7)
  return `case-${hash.toString(36)}`
}

function resolveRoot(project?: string, root?: string): string {
  return path.resolve(project ?? root ?? process.cwd())
}

function resolvePlatform(value: string | undefined): AgentPlatform | undefined {
  if (value === undefined) return undefined
  return normalizeAgentPlatform(value)
}

export function makeSkillCommand(): Command {
  const skill = new Command('skill')
  skill.description('管理项目 skill:发现、校验用例契约、生成用例编写指令包')

  // --- skill list ---
  skill
    .command('list')
    .description('列出项目内已安装的 skill(读取 .codex/.claude/.zcode/skills)')
    .option('--project <path>', '项目根目录(默认 cwd)')
    .option('--platform <name>', '覆盖 config.agentPlatform(codex/claude/zcode)')
    .action(async (cmdOpts: { project?: string; platform?: string }) => {
      const root = resolveRoot(cmdOpts.project)
      try {
        const runtime = createRuntime({ projectRoot: root })
        const opts: SkillListOptions = {
          ...(resolvePlatform(cmdOpts.platform)
            ? { platform: resolvePlatform(cmdOpts.platform) }
            : {}),
        }
        const result = await runtime.skillList(opts)
        for (const e of result.errors) printRuntimeError(e)
        if (result.platform) printInfo(`平台:${result.platform}`)
        if (result.skills.length === 0) {
          printInfo('未发现 skill(检查 .codex/.claude/.zcode/skills/ 是否存在 SKILL.md)。')
        } else {
          printSuccess(`发现 ${result.skills.length} 个 skill:`)
          for (const s of result.skills) {
            const desc = s.description ? ` — ${s.description}` : ''
            const refs = s.references.length > 0 ? ` [refs: ${s.references.join(', ')}]` : ''
            printInfo(`- ${s.name}${desc}${refs}`)
            printInfo(`  ${s.path}`)
          }
        }
        process.exitCode = result.ok ? 0 : 1
      } catch (err) {
        printRuntimeError(toRuntimeError(err, { code: 'skill_list_failed' }))
        process.exitCode = 1
      }
    })

  // --- skill validate ---
  skill
    .command('validate')
    .description('校验用例 Markdown 是否符合 auto-e2e 用例契约(并可校验 skill 存在性)')
    .option('--project <path>', '项目根目录(默认 cwd)')
    .option('--skill <name>', '同时校验该 skill 存在')
    .option('--case <text>', '用例 Markdown 内容(与 --case-file 二选一)')
    .option('--case-file <file>', '用例 Markdown 文件路径(与 --case 二选一)')
    .action(
      async (cmdOpts: { project?: string; skill?: string; case?: string; caseFile?: string }) => {
        const root = resolveRoot(cmdOpts.project)
        try {
          const runtime = createRuntime({ projectRoot: root })
          const opts: SkillValidateOptions = {
            ...(cmdOpts.skill !== undefined ? { skill: cmdOpts.skill } : {}),
            ...(cmdOpts.case !== undefined ? { caseMarkdown: cmdOpts.case } : {}),
            ...(cmdOpts.caseFile !== undefined ? { caseFile: cmdOpts.caseFile } : {}),
          }
          const result = await runtime.skillValidate(opts)
          if (result.ok) {
            printSuccess('用例契约校验通过。')
          } else {
            printRuntimeError(
              toRuntimeError(new Error('用例契约校验未通过'), { code: 'case_invalid' }),
            )
          }
          for (const e of result.errors) printRuntimeError(e)
          process.exitCode = result.ok ? 0 : 1
        } catch (err) {
          printRuntimeError(toRuntimeError(err, { code: 'skill_validate_failed' }))
          process.exitCode = 1
        }
      },
    )

  // --- skill generate ---
  skill
    .command('generate')
    .description('依据 skill 规则 + target,生成「用例编写指令包」(供外部 Agent 编写用例)')
    .requiredOption('--skill <name>', 'skill 名称')
    .requiredOption('--target <text>', '用例目标的自然语言描述')
    .option('--slug <slug>', '用例 slug(留空则从 target 派生)')
    .option('--route <route>', '目标路由')
    .option('--project <path>', '项目根目录(默认 cwd)')
    .option('--platform <name>', '覆盖 config.agentPlatform(codex/claude/zcode)')
    .option('--case-dir <dir>', '覆盖建议的最终用例输出目录(默认 tests/auto-e2e-cases)')
    .option('--force', '覆盖已存在的指令包')
    .action(
      async (cmdOpts: {
        skill: string
        target: string
        slug?: string
        route?: string
        project?: string
        platform?: string
        caseDir?: string
        force?: boolean
      }) => {
        const root = resolveRoot(cmdOpts.project)
        const slug = (cmdOpts.slug?.trim() || deriveSlugFromTarget(cmdOpts.target)).trim()
        try {
          const runtime = createRuntime({ projectRoot: root })
          const opts: SkillGenerateOptions = {
            skill: cmdOpts.skill,
            target: cmdOpts.target,
            slug,
            ...(cmdOpts.route !== undefined ? { route: cmdOpts.route } : {}),
            ...(resolvePlatform(cmdOpts.platform)
              ? { platform: resolvePlatform(cmdOpts.platform) }
              : {}),
            ...(cmdOpts.caseDir !== undefined ? { caseDir: cmdOpts.caseDir } : {}),
            ...(cmdOpts.force ? { force: true } : {}),
          }
          const result = await runtime.skillGenerate(opts)
          for (const e of result.errors) printRuntimeError(e)
          if (result.ok) {
            printSuccess(`用例编写指令包已生成:${slug}`)
            if (result.briefPath) printInfo(`case-brief: ${result.briefPath}`)
            if (result.suggestedCasePath) {
              printInfo(`建议用例路径: ${result.suggestedCasePath}`)
            }
            if (result.scanTriggered) {
              printInfo('未发现 scan 产物,已自动触发 auto-e2e scan 以补充上下文。')
            }
            printInfo(
              '下一步: 由编码 Agent 依据指令包编写用例,再执行 `auto-e2e skill validate --case-file <路径>` 校验。',
            )
          }
          process.exitCode = result.ok ? 0 : 1
        } catch (err) {
          printRuntimeError(toRuntimeError(err, { code: 'skill_generate_failed' }))
          process.exitCode = 1
        }
      },
    )

  return skill
}
