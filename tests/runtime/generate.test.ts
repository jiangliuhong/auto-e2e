import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { createRuntime } from '../../src/runtime/factory.js'
import { specBriefPath } from '../../src/runtime/storage/paths.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-generate-'))
})
afterEach(async () => {
  await fse.remove(root)
})

/** 一个最小可扫描的 Next.js 项目 fixture(供 generate 内部自动 scan 使用)。 */
async function nextFixture() {
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

describe('DefaultRuntime.generate', () => {
  it('内联文本用例 → 落盘指令包,内容含用例文本与建议 spec 路径', async () => {
    await nextFixture()
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.generate({
      name: 'login',
      description: '用户用 demo/demo1234 登录,应跳转到 /dashboard',
    })

    expect(result.ok).toBe(true)
    expect(result.briefPath).toBe(specBriefPath(root, 'login'))
    expect(result.suggestedSpecPath).toBe(path.join(root, 'e2e', 'login.spec.ts'))

    const brief = await fse.readFile(result.briefPath!, 'utf8')
    expect(brief).toContain('用户用 demo/demo1234 登录')
    expect(brief).toContain('login-submit') // 来自自动 scan 的选择器
  })

  it('未跑 scan 时自动触发 scan(scanTriggered=true)', async () => {
    await nextFixture()
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.generate({ name: 'login', description: '登录' })

    expect(result.scanTriggered).toBe(true)
    // brief 应包含从 fixture 扫出的路由/选择器
    const brief = await fse.readFile(result.briefPath!, 'utf8')
    expect(brief).toContain('login-submit')
  })

  it('caseFile 读取文件内容写入', async () => {
    await nextFixture()
    const caseFile = path.join(root, 'case.md')
    await fse.outputFile(caseFile, '# 登录用例\n用户登录后跳转 /dashboard')
    const runtime = createRuntime({ projectRoot: root })

    const result = await runtime.generate({ name: 'login', caseFile })

    expect(result.ok).toBe(true)
    const brief = await fse.readFile(result.briefPath!, 'utf8')
    expect(brief).toContain('# 登录用例')
    expect(brief).toContain('用户登录后跳转 /dashboard')
  })

  it('caseFile 不存在 → ok=false 且 error code 正确', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.generate({ name: 'login', caseFile: 'nope.md' })
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('generate_case_file_missing')
  })

  it('未 force 且指令包已存在 → ok=false 且不覆盖', async () => {
    await nextFixture()
    const runtime = createRuntime({ projectRoot: root })
    await runtime.generate({ name: 'login', description: '原始用例' })

    const result = await runtime.generate({ name: 'login', description: '新用例' })

    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('generate_brief_exists')
    const brief = await fse.readFile(result.briefPath!, 'utf8')
    expect(brief).toContain('原始用例')
    expect(brief).not.toContain('新用例')
  })

  it('--force 覆盖已存在指令包', async () => {
    await nextFixture()
    const runtime = createRuntime({ projectRoot: root })
    await runtime.generate({ name: 'login', description: '原始用例' })

    const result = await runtime.generate({
      name: 'login',
      description: '新用例',
      force: true,
    })

    expect(result.ok).toBe(true)
    const brief = await fse.readFile(result.briefPath!, 'utf8')
    expect(brief).toContain('新用例')
  })

  it('缺少 name → ok=false', async () => {
    const runtime = createRuntime({ projectRoot: root })
    // name 是必填字段,这里用类型断言绕过编译期校验以测试运行期行为
    const result = await runtime.generate({ name: '', description: 'x' } as never)
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('generate_invalid_input')
  })

  it('缺少文本用例 → ok=false', async () => {
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.generate({ name: 'login' })
    expect(result.ok).toBe(false)
    expect(result.errors[0]?.code).toBe('generate_invalid_input')
  })

  it('--spec-dir 覆盖建议 spec 路径', async () => {
    await nextFixture()
    const runtime = createRuntime({ projectRoot: root })
    const result = await runtime.generate({
      name: 'login',
      description: '登录',
      specDir: 'tests/e2e',
    })
    expect(result.suggestedSpecPath).toBe(path.join(root, 'tests', 'e2e', 'login.spec.ts'))
  })
})
