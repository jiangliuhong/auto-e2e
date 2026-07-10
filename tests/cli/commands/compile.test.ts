// compile 命令的 Runtime 层端到端测试(createRuntime → compile)。
// 覆盖:合法用例生成 spec、契约校验失败拒绝、caseFile 缺失、--force 覆盖、
// config 注入 viewport/storageState、产物路径。
// 与 generate.test.ts / skill.test.ts 风格一致:tmpdir 隔离。

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { createRuntime } from '../../../src/runtime/factory.js'
import { configPath } from '../../../src/runtime/storage/paths.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-compile-'))
})
afterEach(async () => {
  await fse.remove(root)
})

const validCaseMd = `# PL 参数集详情页

## Target
- route: /global/pl-report/parameters?country=mx
- module: pl-forecast
- type: readonly-smoke

## Preconditions
- app: web + api development server
- auth: use development login helper

## Steps
1. 登录具备菜单权限的用户。
2. 打开 \`/global/pl-report/parameters?country=mx\`。
3. 等待参数集列表加载完成。

## Assertions
- 页面标题可见。
- 参数集选择器可见。

## Network Expectations
- GET /api/pl/forecast/parameter-sets

## Stability Notes
- 优先使用 role、label、visible text。
- 禁止使用绝对 XPath。
- 页面无 401、403、500 错误提示。
`

describe('DefaultRuntime.compile', () => {
  it('合法用例 → 生成 spec 骨架,含 goto/steps/assertions/network', async () => {
    const caseFile = path.join(root, 'pl-detail.md')
    await fse.outputFile(caseFile, validCaseMd)
    const out = path.join(root, 'tests', 'auto-e2e-generated', 'pl-detail.spec.ts')
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.compile({ caseFile, out })

    expect(result.ok).toBe(true)
    expect(result.specPath).toBe(out)
    expect(result.suggestedRunCommand).toContain('auto-e2e run --spec')
    const spec = await fse.readFile(out, 'utf8')
    expect(spec).toContain("import { test, expect } from '@playwright/test'")
    expect(spec).toContain("test.describe('PL 参数集详情页'")
    expect(spec).toContain("test('pl-detail'")
    expect(spec).toContain("page.goto('/global/pl-report/parameters?country=mx')")
    expect(spec).toContain("'1. 登录具备菜单权限的用户。'")
    expect(spec).toContain('api_pl_forecast_parameter_setsCount')
    expect(spec).toContain('errorResponses')
    expect(spec).toContain('TODO')
  })

  it('用例文件不存在 → compile_case_file_missing', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.compile({ caseFile: '/nope.md', out: '/nope.spec.ts' })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'compile_case_file_missing')).toBe(true)
  })

  it('契约校验失败(缺必填段) → 拒绝编译,不落盘', async () => {
    const caseFile = path.join(root, 'bad.md')
    await fse.outputFile(caseFile, '# Bad\n## Target\n- route: /x\n')
    const out = path.join(root, 'bad.spec.ts')
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.compile({ caseFile, out })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'case_section_missing')).toBe(true)
    expect(await fse.pathExists(out)).toBe(false)
  })

  it('写操作守门:含创建但无声明 → 拒绝编译', async () => {
    const caseFile = path.join(root, 'write.md')
    await fse.outputFile(
      caseFile,
      `# W
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
    )
    const out = path.join(root, 'w.spec.ts')
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.compile({ caseFile, out })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'case_write_op_undeclared')).toBe(true)
  })

  it('已存在且未 force → compile_spec_exists', async () => {
    const caseFile = path.join(root, 'pl-detail.md')
    await fse.outputFile(caseFile, validCaseMd)
    const out = path.join(root, 'gen', 'pl-detail.spec.ts')
    const runtime = createRuntime({ projectRoot: root })
    await runtime.compile({ caseFile, out })
    const result = await runtime.compile({ caseFile, out })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'compile_spec_exists')).toBe(true)
  })

  it('--force 覆盖已存在 spec', async () => {
    const caseFile = path.join(root, 'pl-detail.md')
    await fse.outputFile(caseFile, validCaseMd)
    const out = path.join(root, 'gen', 'pl-detail.spec.ts')
    const runtime = createRuntime({ projectRoot: root })
    await runtime.compile({ caseFile, out })
    const result = await runtime.compile({ caseFile, out, force: true })
    expect(result.ok).toBe(true)
  })

  it('config 注入 viewport + storageState 到 test.use', async () => {
    await fse.ensureDir(path.join(root, '.auto-e2e'))
    await fse.writeJson(configPath(root), {
      baseUrl: 'http://localhost:3000',
      viewport: { width: 1280, height: 720 },
      storageState: '.auth/state.json',
    })
    const caseFile = path.join(root, 'pl-detail.md')
    await fse.outputFile(caseFile, validCaseMd)
    const out = path.join(root, 'pl-detail.spec.ts')
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.compile({ caseFile, out })
    expect(result.ok).toBe(true)
    const spec = await fse.readFile(out, 'utf8')
    expect(spec).toContain('viewport: { width: 1280, height: 720 },')
    expect(spec).toContain("storageState: '.auth/state.json',")
  })

  it('无 config 时不渲染 test.use,spec 仍合法', async () => {
    const caseFile = path.join(root, 'pl-detail.md')
    await fse.outputFile(caseFile, validCaseMd)
    const out = path.join(root, 'pl-detail.spec.ts')
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.compile({ caseFile, out })
    expect(result.ok).toBe(true)
    const spec = await fse.readFile(out, 'utf8')
    expect(spec).not.toContain('test.use({')
  })

  it('产物 spec 为合法 TS:括号配平、含 import/describe/test', async () => {
    const caseFile = path.join(root, 'pl-detail.md')
    await fse.outputFile(caseFile, validCaseMd)
    const out = path.join(root, 'pl-detail.spec.ts')
    const runtime = createRuntime({ projectRoot: root })
    await runtime.compile({ caseFile, out })
    const spec = await fse.readFile(out, 'utf8')
    // 基本合法性检查:括号配平
    const open = (spec.match(/\{/g) ?? []).length
    const close = (spec.match(/\}/g) ?? []).length
    expect(open).toBe(close)
    const openParen = (spec.match(/\(/g) ?? []).length
    const closeParen = (spec.match(/\)/g) ?? []).length
    expect(openParen).toBe(closeParen)
    // 无 undefined 泄漏
    expect(spec).not.toContain('undefined')
  })
})
