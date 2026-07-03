import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { CompositeScanner } from '../../src/scanner/composite-scanner.js'
import { NextScannerProvider } from '../../src/scanner/next-scanner.js'
import { ReactViteScannerProvider } from '../../src/scanner/react-vite-scanner.js'
import type { ScannerProvider } from '../../src/scanner/scanner-provider.js'
import type { AppMap } from '../../src/core/models.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-composite-'))
})
afterEach(async () => {
  await fse.remove(root)
})

/** 构造一个最小的 Next 项目 fixture。 */
async function nextFixture() {
  await fse.writeJson(path.join(root, 'package.json'), {
    name: 'demo',
    packageManager: 'pnpm@9.0.0',
    dependencies: { next: '14.0.0' },
    scripts: { dev: 'next dev', build: 'next build', 'test:e2e': 'playwright test' },
  })
  await fse.outputFile(
    path.join(root, 'src/app/page.tsx'),
    'export default function Page(){return null}',
  )
  await fse.outputFile(
    path.join(root, 'src/app/login/page.tsx'),
    '<button data-testid="login-submit">Login</button>',
  )
  await fse.outputFile(path.join(root, 'playwright.config.ts'), 'export default {}')
}

describe('CompositeScanner', () => {
  it('命中 Next provider 并产出完整 AppMap', async () => {
    await nextFixture()
    const scanner = new CompositeScanner({
      providers: [new NextScannerProvider(), new ReactViteScannerProvider()],
    })
    const result = await scanner.scan(root)
    expect(result.ok).toBe(true)
    expect(result.appMap.framework).toBe('nextjs')
    expect(result.appMap.packageManager).toBe('pnpm')
    expect(result.appMap.scripts.dev).toBe('next dev')
    expect(result.appMap.routes.map((r) => r.path)).toEqual(expect.arrayContaining(['/', '/login']))
    expect(result.selectorMap.items.map((i) => i.value)).toContain('login-submit')
    expect(result.appMap.playwright?.configFile).toBe('playwright.config.ts')
  })

  it('无 provider 命中时兜底 unknown,不抛错', async () => {
    await fse.writeJson(path.join(root, 'package.json'), {
      name: 'plain',
      scripts: { dev: 'node server.js' },
    })
    const scanner = new CompositeScanner({ providers: [new NextScannerProvider()] })
    const result = await scanner.scan(root)
    expect(result.ok).toBe(true)
    expect(result.appMap.framework).toBe('unknown')
    expect(result.appMap.scripts.dev).toBe('node server.js')
  })

  it('detect 失败时回退到下一个 provider', async () => {
    await nextFixture()
    // 第一个 provider 总是 detect=false,应回退到 NextScannerProvider
    const alwaysNo: ScannerProvider = {
      name: 'always-no',
      async detect() {
        return false
      },
      async scan() {
        return {} as Partial<AppMap>
      },
    }
    const scanner = new CompositeScanner({ providers: [alwaysNo, new NextScannerProvider()] })
    const result = await scanner.scan(root)
    expect(result.appMap.framework).toBe('nextjs')
  })
})
