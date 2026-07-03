import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import { detectFramework } from '../../src/scanner/framework.js'

let root: string

beforeEach(async () => {
  root = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-fw-'))
})
afterEach(async () => {
  await fse.remove(root)
})

async function writePkg(deps: Record<string, string> = {}, dev: Record<string, string> = {}) {
  await fse.writeJson(path.join(root, 'package.json'), { dependencies: deps, devDependencies: dev })
}

describe('detectFramework', () => {
  it('next 依赖 → nextjs', async () => {
    await writePkg({ next: '14.0.0' })
    expect((await detectFramework(root)).framework).toBe('nextjs')
  })

  it('next.config.ts → nextjs', async () => {
    await writePkg()
    await fse.createFile(path.join(root, 'next.config.ts'))
    expect((await detectFramework(root)).framework).toBe('nextjs')
  })

  it('vite + react → react-vite', async () => {
    await writePkg({ vite: '5.0.0', react: '18.0.0' })
    expect((await detectFramework(root)).framework).toBe('react-vite')
  })

  it('vite + @vitejs/plugin-vue + vue → vue-vite', async () => {
    await writePkg({ vite: '5.0.0' }, { vue: '3.0.0', '@vitejs/plugin-vue': '5.0.0' })
    expect((await detectFramework(root)).framework).toBe('vue-vite')
  })

  it('无匹配 → unknown', async () => {
    await writePkg()
    expect((await detectFramework(root)).framework).toBe('unknown')
  })
})
