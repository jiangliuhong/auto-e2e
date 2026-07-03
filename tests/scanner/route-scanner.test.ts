import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { scanNextRoutes } from '../../src/scanner/route-scanner.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-routes-'))
})
afterEach(async () => {
  await fse.remove(root)
})

async function write(file: string, content = '') {
  const abs = path.join(root, file)
  await fse.ensureDir(path.dirname(abs))
  await fse.writeFile(abs, content)
}

describe('scanNextRoutes', () => {
  it('app router: 首页与嵌套路由', async () => {
    await write('src/app/page.tsx')
    await write('src/app/login/page.tsx')
    await write('src/app/users/[id]/page.tsx')
    const { routes } = await scanNextRoutes(root, ['src', '.'])
    const paths = routes.map((r) => r.path)
    expect(paths).toEqual(expect.arrayContaining(['/', '/login', '/users/:id']))
    expect(routes[0]?.source).toBe('src/app/page.tsx')
  })

  it('忽略路由组与私有目录', async () => {
    await write('src/app/(marketing)/about/page.tsx')
    await write('src/app/_private/page.tsx')
    const { routes } = await scanNextRoutes(root, ['src', '.'])
    expect(routes.map((r) => r.path)).toEqual(['/about'])
  })

  it('pages router: index 与动态路由', async () => {
    await write('src/pages/index.tsx')
    await write('src/pages/posts/[slug].tsx')
    // _app/_document 应被排除
    await write('src/pages/_app.tsx')
    await write('src/pages/_document.tsx')
    const { routes } = await scanNextRoutes(root, ['src', '.'])
    const paths = routes.map((r) => r.path)
    expect(paths).toEqual(expect.arrayContaining(['/', '/posts/:slug']))
    expect(paths).not.toContain('/_app')
    expect(paths).not.toContain('/_document')
  })

  it('api 路由归入 apiRoutes', async () => {
    await write('src/app/api/users/route.ts')
    const { routes, apiRoutes } = await scanNextRoutes(root, ['src', '.'])
    expect(routes).toHaveLength(0)
    expect(apiRoutes.map((r) => r.path)).toContain('/api/users')
  })

  it('结果按路径排序(确定性)', async () => {
    await write('src/app/zebra/page.tsx')
    await write('src/app/apple/page.tsx')
    await write('src/app/mango/page.tsx')
    const { routes } = await scanNextRoutes(root, ['src', '.'])
    expect(routes.map((r) => r.path)).toEqual(['/apple', '/mango', '/zebra'])
  })
})
