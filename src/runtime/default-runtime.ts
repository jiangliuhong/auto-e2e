// DefaultRuntime:AutoE2ERuntime 的默认实现。
// 通过构造函数注入各 provider(storage / environment / scanner / executor),
// 对齐 AGENTS.md「优先依赖注入」「Provider 必须可替换」。
// observe/report 在本阶段(4/6)返回 notImplementedError,
// prepare/cleanup/scan/run/doctor 委托对应 provider。

import path from 'node:path'
import {
  notImplementedError,
  type AutoE2ERuntime,
  type RuntimeError,
  type CleanupOptions,
  type CleanupResult,
  type CompileOptions,
  type CompileResult,
  type DoctorOptions,
  type DoctorResult,
  type GenerateOptions,
  type GenerateResult,
  type ObserveOptions,
  type ObservationResult,
  type PrepareOptions,
  type PrepareResult,
  type ReportOptions,
  type ReportResult,
  type RunOptions,
  type RunResult,
  type ScanOptions,
  type ScanResult,
  type SkillGenerateOptions,
  type SkillGenerateResult,
  type SkillListOptions,
  type SkillListResult,
  type SkillValidateOptions,
  type SkillValidateResult,
} from '../core/index.js'
import type { AgentPlatform, AppMap, Config, SelectorMap } from '../core/models.js'
import type { StorageService } from './storage/index.js'
import type { EnvironmentProvider } from './environment/index.js'
import type { CompositeScanner } from '../scanner/composite-scanner.js'
import { generateContextMarkdown } from '../scanner/context-generator.js'
import { generateSpecBrief } from './spec-brief.js'
import {
  generateCaseBrief,
  generateCaseSpec,
  normalizeAgentPlatform,
  parseCaseContract,
  readSkillContent,
  readSkills,
  skillRootForPlatform,
  validateCaseMarkdown,
} from './skill/index.js'
import {
  agentContextPath,
  caseBriefPath,
  reportRunDir,
  runResultPath,
  specBriefPath,
} from './storage/paths.js'
import { runDoctor } from './doctor.js'
import { toRuntimeError } from '../utils/errors.js'
import { readText, writeJson, writeText } from '../utils/fs.js'
import type { Executor } from './executor/index.js'

export interface DefaultRuntimeDeps {
  projectRoot: string
  storage: StorageService
  environment: EnvironmentProvider
  scanner: CompositeScanner
  executor: Executor
}

export class DefaultRuntime implements AutoE2ERuntime {
  protected readonly deps: DefaultRuntimeDeps

  constructor(deps: DefaultRuntimeDeps) {
    this.deps = deps
  }

  async prepare(options?: PrepareOptions): Promise<PrepareResult> {
    await this.deps.storage.ensureLayout()
    return this.deps.environment.prepare(options)
  }

  async cleanup(options?: CleanupOptions): Promise<CleanupResult> {
    return this.deps.environment.cleanup(options)
  }

  async scan(options?: ScanOptions): Promise<ScanResult> {
    const root = options?.projectRoot ?? this.deps.projectRoot
    const generateCtx = options?.generateContext ?? true
    await this.deps.storage.ensureLayout()

    const result = await this.deps.scanner.scan(root)
    if (result.errors.length > 0 && result.appMap.framework === 'unknown') {
      // 扫描完全失败则直接返回
      return result
    }

    // 写入 app-map.json / selector-map.json(对齐 OUTPUT_SPEC.md)
    try {
      await this.deps.storage.writeJson('.auto-e2e/app-map.json', result.appMap)
      await this.deps.storage.writeJson('.auto-e2e/selector-map.json', result.selectorMap)

      if (generateCtx) {
        // 生成 agent-context.md(主)+ codex-context.md(向后兼容别名,内容相同)
        const markdown = generateContextMarkdown(result.appMap, result.selectorMap)
        await this.deps.storage.writeText('.auto-e2e/agent-context.md', markdown)
        await this.deps.storage.writeText('.auto-e2e/codex-context.md', markdown)
        return {
          ...result,
          contextPath: agentContextPath(root),
        }
      }
    } catch (err) {
      result.errors.push(toRuntimeError(err, { code: 'scan_write_failed' }))
    }

    return result
  }

  async observe(_options: ObserveOptions): Promise<ObservationResult> {
    return this.notImplemented<ObservationResult>('observer', (errors) => ({
      id: '',
      url: _options.url,
      finalUrl: '',
      title: '',
      elements: [],
      consoleMessages: [],
      networkRequests: [],
      recommendedSelectors: [],
      errors,
      createdAt: new Date().toISOString(),
    }))
  }

  async run(options?: RunOptions): Promise<RunResult> {
    await this.deps.storage.ensureLayout()

    const result = await this.deps.executor.run(options)

    // 写入 run-result.json:顶层快照(最近一次)+ reports/<runId>/ 归档。
    // 对齐 OUTPUT_SPEC.md「目录布局」与 scan() 的「runtime 层负责写文件」模式。
    // 用绝对路径 + paths 函数(writeJson 自动创建父目录,故无需逐 run ensureDir)。
    try {
      const snapshot = runResultPath(this.deps.projectRoot)
      await writeJson(snapshot, result)
      if (result.runId) {
        const archive = path.join(
          reportRunDir(this.deps.projectRoot, result.runId),
          'run-result.json',
        )
        await writeJson(archive, result)
      }
    } catch (err) {
      result.errors.push(toRuntimeError(err, { code: 'run_write_failed' }))
    }

    return result
  }

  async report(_options?: ReportOptions): Promise<ReportResult> {
    return this.notImplemented<ReportResult>('feedback', (errors) => ({ ok: false, errors }))
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const errors: GenerateResult['errors'] = []
    try {
      await this.deps.storage.ensureLayout()

      // 1) 校验必填项并解析文本用例(description 优先,否则读 caseFile)。
      const name = options.name?.trim()
      if (!name) {
        errors.push(
          toRuntimeError(new Error('缺少必填参数 name(用例名称)'), {
            code: 'generate_invalid_input',
            recoverable: true,
          }),
        )
        return { ok: false, errors }
      }

      let description = options.description
      if (description === undefined && options.caseFile) {
        const fileAbs = path.isAbsolute(options.caseFile)
          ? options.caseFile
          : path.resolve(this.deps.projectRoot, options.caseFile)
        const content = await readText(fileAbs)
        if (content === undefined) {
          errors.push(
            toRuntimeError(new Error(`文本用例文件不存在:${options.caseFile}`), {
              code: 'generate_case_file_missing',
              recoverable: true,
              details: { caseFile: options.caseFile },
            }),
          )
          return { ok: false, errors }
        }
        description = content
      }
      if (description === undefined || description.trim() === '') {
        errors.push(
          toRuntimeError(new Error('缺少文本用例(请通过 description 或 caseFile 提供)'), {
            code: 'generate_invalid_input',
            recoverable: true,
          }),
        )
        return { ok: false, errors }
      }

      // 2) 读取 scan 产物(app-map / selector-map);缺失则自动触发一次 scan(幂等)。
      let scanTriggered = false
      let appMap = await this.deps.storage.readJson<AppMap>('.auto-e2e/app-map.json')
      let selectorMap = await this.deps.storage.readJson<SelectorMap>('.auto-e2e/selector-map.json')
      if (appMap === undefined || selectorMap === undefined) {
        scanTriggered = true
        const scanResult = await this.scan({ projectRoot: this.deps.projectRoot })
        if (scanResult.ok) {
          appMap = scanResult.appMap
          selectorMap = scanResult.selectorMap
        } else {
          // scan 失败不阻断生成;上下文节留空,但记下错误供调用方感知。
          for (const e of scanResult.errors) errors.push(e)
        }
      }

      // 3) 读取 config(可缺失,默认值仅用于回退 testDir)。
      const config = await this.deps.storage.readJson<Config>('.auto-e2e/config.json')

      // 4) 推导建议 spec 路径:options.specDir → app-map.playwright.testDir → "e2e"。
      const testDir = options.specDir ?? appMap?.playwright?.testDir ?? 'e2e'
      const suggestedSpecPath = path.posix.join(testDir, `${name}.spec.ts`)

      // 5) 已存在且未 force → 不覆盖。
      const relBrief = `.auto-e2e/spec-briefs/${name}.md`
      const exists = await this.deps.storage.exists(relBrief)
      if (exists && !options.force) {
        errors.push(
          toRuntimeError(new Error(`指令包已存在:${relBrief}(使用 --force 覆盖)`), {
            code: 'generate_brief_exists',
            recoverable: true,
            details: { briefPath: relBrief },
          }),
        )
        return {
          ok: false,
          briefPath: specBriefPath(this.deps.projectRoot, name),
          suggestedSpecPath: path.resolve(this.deps.projectRoot, suggestedSpecPath),
          scanTriggered,
          errors,
        }
      }

      // 6) 渲染并落盘。
      const markdown = generateSpecBrief({
        name,
        description,
        ...(appMap ? { appMap } : {}),
        ...(selectorMap ? { selectorMap } : {}),
        ...(config ? { config } : {}),
        suggestedSpecPath,
      })
      await this.deps.storage.writeText(relBrief, markdown)

      return {
        ok: true,
        briefPath: specBriefPath(this.deps.projectRoot, name),
        suggestedSpecPath: path.resolve(this.deps.projectRoot, suggestedSpecPath),
        scanTriggered,
        errors,
      }
    } catch (err) {
      errors.push(toRuntimeError(err, { code: 'generate_failed', recoverable: true }))
      return { ok: false, errors }
    }
  }

  async doctor(options?: DoctorOptions): Promise<DoctorResult> {
    return runDoctor({ root: this.deps.projectRoot, ...options })
  }

  async skillList(options?: SkillListOptions): Promise<SkillListResult> {
    const errors: SkillListResult['errors'] = []
    try {
      const platform = await this.resolvePlatform(options?.platform)
      const skillRoot = skillRootForPlatform(this.deps.projectRoot, platform)
      const result = await readSkills(skillRoot)
      for (const e of result.errors) errors.push(e)
      return {
        ok: errors.length === 0,
        ...(platform ? { platform } : {}),
        skills: result.skills,
        errors,
      }
    } catch (err) {
      errors.push(toRuntimeError(err, { code: 'skill_list_failed' }))
      return { ok: false, skills: [], errors }
    }
  }

  async skillValidate(options: SkillValidateOptions): Promise<SkillValidateResult> {
    const errors: SkillValidateResult['errors'] = []
    try {
      // 1) 解析用例文本(caseMarkdown 优先,否则读 caseFile)。
      let markdown = options.caseMarkdown
      if (markdown === undefined && options.caseFile) {
        const fileAbs = path.isAbsolute(options.caseFile)
          ? options.caseFile
          : path.resolve(this.deps.projectRoot, options.caseFile)
        const content = await readText(fileAbs)
        if (content === undefined) {
          errors.push(
            toRuntimeError(new Error(`用例文件不存在:${options.caseFile}`), {
              code: 'skill_case_file_missing',
              recoverable: true,
              details: { caseFile: options.caseFile },
            }),
          )
          return { ok: false, errors }
        }
        markdown = content
      }
      if (markdown === undefined || markdown.trim() === '') {
        errors.push(
          toRuntimeError(new Error('缺少用例文本(请通过 caseMarkdown 或 caseFile 提供)'), {
            code: 'skill_validate_invalid_input',
            recoverable: true,
          }),
        )
        return { ok: false, errors }
      }

      // 2) (可选)校验 skill 存在性。
      if (options.skill) {
        const platform = await this.resolvePlatform(undefined)
        const skillRoot = skillRootForPlatform(this.deps.projectRoot, platform)
        const content = await readSkillContent(skillRoot, options.skill)
        if (content === undefined) {
          errors.push(
            toRuntimeError(new Error(`skill 不存在:${options.skill}`), {
              code: 'skill_not_found',
              recoverable: true,
              details: { skill: options.skill },
            }),
          )
        }
      }

      // 3) 校验用例契约。
      const parsed = parseCaseContract(markdown)
      if ('errors' in parsed) {
        for (const msg of parsed.errors) {
          errors.push(
            toRuntimeError(new Error(msg), { code: 'case_parse_failed', recoverable: true }),
          )
        }
        return { ok: false, errors }
      }
      const validation = validateCaseMarkdown(markdown)
      for (const e of validation.errors) errors.push(e)
      return { ok: errors.length === 0, ...(validation.ok ? { testCase: parsed } : {}), errors }
    } catch (err) {
      errors.push(toRuntimeError(err, { code: 'skill_validate_failed' }))
      return { ok: false, errors }
    }
  }

  async skillGenerate(options: SkillGenerateOptions): Promise<SkillGenerateResult> {
    const errors: SkillGenerateResult['errors'] = []
    try {
      await this.deps.storage.ensureLayout()

      // 1) 校验必填项。
      const skill = options.skill?.trim()
      const target = options.target?.trim()
      const slug = options.slug?.trim()
      if (!skill) {
        errors.push(
          toRuntimeError(new Error('缺少必填参数 skill(skill 名称)'), {
            code: 'skill_generate_invalid_input',
            recoverable: true,
          }),
        )
        return { ok: false, errors }
      }
      if (!target) {
        errors.push(
          toRuntimeError(new Error('缺少必填参数 target(用例目标)'), {
            code: 'skill_generate_invalid_input',
            recoverable: true,
          }),
        )
        return { ok: false, errors }
      }
      if (!slug) {
        errors.push(
          toRuntimeError(new Error('缺少必填参数 slug(用例 slug)'), {
            code: 'skill_generate_invalid_input',
            recoverable: true,
          }),
        )
        return { ok: false, errors }
      }

      // 2) 读 config + 解析 platform。
      const config = await this.deps.storage.readJson<Config>('.auto-e2e/config.json')
      const platform = await this.resolvePlatform(options.platform)

      // 3) 读 skill 内容(SKILL.md + references);不存在则报错。
      const skillRoot = skillRootForPlatform(this.deps.projectRoot, platform)
      const skillContent = await readSkillContent(skillRoot, skill)
      if (skillContent === undefined) {
        errors.push(
          toRuntimeError(new Error(`skill 不存在:${skill}(在 ${platform} 平台目录下)`), {
            code: 'skill_not_found',
            recoverable: true,
            details: { skill, platform },
          }),
        )
        return { ok: false, errors }
      }

      // 4) 读 scan 产物;缺失则自动触发一次 scan(幂等,镜像 generate())。
      let scanTriggered = false
      let appMap = await this.deps.storage.readJson<AppMap>('.auto-e2e/app-map.json')
      let selectorMap = await this.deps.storage.readJson<SelectorMap>('.auto-e2e/selector-map.json')
      if (appMap === undefined || selectorMap === undefined) {
        scanTriggered = true
        const scanResult = await this.scan({ projectRoot: this.deps.projectRoot })
        if (scanResult.ok) {
          appMap = scanResult.appMap
          selectorMap = scanResult.selectorMap
        } else {
          for (const e of scanResult.errors) errors.push(e)
        }
      }

      // 5) 推导建议用例路径:<caseDir>/<slug>/<slug>.md。
      // module 分段由 Agent 编写时自行调整;此处给一个稳定默认。
      const caseDir = options.caseDir ?? 'tests/auto-e2e-cases'
      const suggestedCasePath = path.posix.join(caseDir, slug, `${slug}.md`)

      // 6) 已存在且未 force → 不覆盖。
      const relBrief = `.auto-e2e/case-briefs/${slug}.md`
      const exists = await this.deps.storage.exists(relBrief)
      if (exists && !options.force) {
        errors.push(
          toRuntimeError(new Error(`用例编写指令包已存在:${relBrief}(使用 --force 覆盖)`), {
            code: 'skill_generate_brief_exists',
            recoverable: true,
            details: { briefPath: relBrief },
          }),
        )
        return {
          ok: false,
          briefPath: caseBriefPath(this.deps.projectRoot, slug),
          suggestedCasePath: path.resolve(this.deps.projectRoot, suggestedCasePath),
          scanTriggered,
          errors,
        }
      }

      // 7) 渲染并落盘。
      const markdown = generateCaseBrief({
        skillName: skill,
        slug,
        target,
        ...(options.route !== undefined ? { route: options.route } : {}),
        skillMarkdown: skillContent.skillMarkdown,
        references: skillContent.references,
        ...(appMap ? { appMap } : {}),
        ...(selectorMap ? { selectorMap } : {}),
        ...(config ? { config } : {}),
        suggestedCasePath,
      })
      await this.deps.storage.writeText(relBrief, markdown)

      return {
        ok: true,
        briefPath: caseBriefPath(this.deps.projectRoot, slug),
        suggestedCasePath: path.resolve(this.deps.projectRoot, suggestedCasePath),
        scanTriggered,
        errors,
      }
    } catch (err) {
      errors.push(toRuntimeError(err, { code: 'skill_generate_failed', recoverable: true }))
      return { ok: false, errors }
    }
  }

  async compile(options: CompileOptions): Promise<CompileResult> {
    const errors: CompileResult['errors'] = []
    try {
      await this.deps.storage.ensureLayout()

      // 1) 读取用例 Markdown 文件。
      const caseAbs = path.isAbsolute(options.caseFile)
        ? options.caseFile
        : path.resolve(this.deps.projectRoot, options.caseFile)
      const markdown = await readText(caseAbs)
      if (markdown === undefined) {
        errors.push(
          toRuntimeError(new Error(`用例文件不存在:${options.caseFile}`), {
            code: 'compile_case_file_missing',
            recoverable: true,
            details: { caseFile: options.caseFile },
          }),
        )
        return { ok: false, errors }
      }

      // 2) 先校验契约(缺必填段 / 写操作未声明 → 拒绝编译)。
      const validation = validateCaseMarkdown(markdown)
      if (!validation.ok) {
        for (const e of validation.errors) errors.push(e)
        return { ok: false, errors }
      }

      // 3) 解析契约(校验已通过,解析必成功)。
      const parsed = parseCaseContract(markdown)
      if ('errors' in parsed) {
        // 理论不可达:校验通过意味着解析成功。防御性处理。
        errors.push(
          toRuntimeError(new Error('用例契约解析失败(校验已通过却无法解析)'), {
            code: 'compile_parse_failed',
          }),
        )
        return { ok: false, errors }
      }

      // 4) 读 config(用于 viewport/storageState,可缺失)。
      const config = await this.deps.storage.readJson<Config>('.auto-e2e/config.json')

      // 5) 推导 slug(用例文件名,去掉 .md),用于 test 名与溯源注释。
      const baseName = path.basename(options.caseFile, '.md')

      // 6) 解析输出路径(相对项目根)。
      const outAbs = path.isAbsolute(options.out)
        ? options.out
        : path.resolve(this.deps.projectRoot, options.out)

      // 7) --force 守门。
      const outExists = await this.deps.storage.exists(path.relative(this.deps.projectRoot, outAbs))
      if (outExists && !options.force) {
        errors.push(
          toRuntimeError(new Error(`spec 已存在:${outAbs}(使用 --force 覆盖)`), {
            code: 'compile_spec_exists',
            recoverable: true,
            details: { out: outAbs },
          }),
        )
        return { ok: false, specPath: outAbs, errors }
      }

      // 8) 渲染并落盘。
      const spec = generateCaseSpec({
        testCase: parsed,
        slug: baseName,
        ...(config ? { config } : {}),
        sourceFile: path.relative(this.deps.projectRoot, caseAbs) || options.caseFile,
      })
      await writeText(outAbs, spec)

      return {
        ok: true,
        specPath: outAbs,
        suggestedRunCommand: `auto-e2e run --spec ${path.relative(this.deps.projectRoot, outAbs) || outAbs}`,
        errors,
      }
    } catch (err) {
      errors.push(toRuntimeError(err, { code: 'compile_failed', recoverable: true }))
      return { ok: false, errors }
    }
  }

  // --- 内部工具 ---

  /**
   * 解析 platform:options 显式覆盖 → config.agentPlatform → 默认 codex。
   */
  private async resolvePlatform(override?: AgentPlatform): Promise<AgentPlatform> {
    if (override) return override
    const config = await this.deps.storage.readJson<Config>('.auto-e2e/config.json')
    const fromConfig = normalizeAgentPlatform(config?.agentPlatform)
    return fromConfig ?? 'codex'
  }

  /**
   * 统一生成 not_implemented 结果,把错误塞进 result.errors。
   */
  private async notImplemented<T>(
    capability: string,
    build: (errors: RuntimeError[]) => T,
  ): Promise<T> {
    const err = notImplementedError(capability)
    return build([err])
  }
}
