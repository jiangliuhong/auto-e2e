import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { scanTestIds } from '../../src/scanner/testid-scanner.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-testid-'))
})
afterEach(async () => {
  await fse.remove(root)
})

async function write(file: string, content = '') {
  const abs = path.join(root, file)
  await fse.ensureDir(path.dirname(abs))
  await fse.writeFile(abs, content)
}

describe('scanTestIds', () => {
  it('提取 data-testid 双引号值', async () => {
    await write('src/app/login/page.tsx', '<button data-testid="login-submit">Login</button>')
    const result = await scanTestIds(root)
    expect(result.items).toEqual([
      {
        source: 'src/app/login/page.tsx',
        kind: 'data-testid',
        value: 'login-submit',
        confidence: 0.95,
      },
    ])
  })

  it('提取单引号值并去重', async () => {
    await write('a.tsx', "<input data-testid='email' />")
    await write('b.tsx', "<input data-testid='email' />") // 重复
    await write('c.tsx', '<div data-testid="password"></div>')
    const result = await scanTestIds(root)
    expect(result.items.map((i) => i.value)).toEqual(['email', 'password'])
  })

  it('忽略 node_modules 与 dist', async () => {
    await write('src/real.tsx', '<div data-testid="kept"></div>')
    await write('node_modules/pkg/x.tsx', '<div data-testid="ignored"></div>')
    await write('dist/built.tsx', '<div data-testid="ignored2"></div>')
    const result = await scanTestIds(root)
    expect(result.items.map((i) => i.value)).toEqual(['kept'])
  })

  it('结果按 value 排序(确定性)', async () => {
    await write('z.tsx', '<div data-testid="zeta"></div>')
    await write('a.tsx', '<div data-testid="alpha"></div>')
    const result = await scanTestIds(root)
    expect(result.items.map((i) => i.value)).toEqual(['alpha', 'zeta'])
  })

  it('无匹配时返回空数组', async () => {
    await write('src/x.tsx', '<div>no testid here</div>')
    const result = await scanTestIds(root)
    expect(result.items).toEqual([])
  })
})
