import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fse from 'fs-extra'
import {
  ensureDir,
  pathExists,
  readJson,
  writeJson,
  readText,
  writeText,
} from '../../src/utils/fs.js'

let tmp: string

beforeEach(async () => {
  tmp = await fse.mkdtemp(path.join(os.tmpdir(), 'autoe2e-fs-'))
})

afterEach(async () => {
  await fse.remove(tmp)
})

describe('fs utils', () => {
  it('writeJson/readJson 稳定往返(2 空格 + 末尾换行)', async () => {
    const file = path.join(tmp, 'a', 'b.json')
    await writeJson(file, { z: 1, a: 2 })
    const raw = await fse.readFile(file, 'utf8')
    expect(raw).toBe('{\n  "z": 1,\n  "a": 2\n}\n')
    expect(await readJson(file)).toEqual({ z: 1, a: 2 })
  })

  it('readJson 文件不存在时返回 undefined', async () => {
    expect(await readJson(path.join(tmp, 'nope.json'))).toBeUndefined()
  })

  it('writeText/readText 往返', async () => {
    const file = path.join(tmp, 'sub', 'x.md')
    await writeText(file, '# hi')
    expect(await readText(file)).toBe('# hi')
  })

  it('readText 文件不存在时返回 undefined', async () => {
    expect(await readText(path.join(tmp, 'nope.md'))).toBeUndefined()
  })

  it('ensureDir 创建多级目录', async () => {
    const dir = path.join(tmp, 'x', 'y', 'z')
    await ensureDir(dir)
    expect(await pathExists(dir)).toBe(true)
  })
})
