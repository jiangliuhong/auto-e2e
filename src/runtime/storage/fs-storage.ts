// 基于文件系统的 Storage 实现。
// 所有 relPath 均相对 root(.auto-e2e/ 的父目录,即项目根)。
// 注意:这里的 relPath 是相对 root 的路径(例如 ".auto-e2e/config.json"),
// 这样调用方既能写 .auto-e2e/ 内产物,也能在必要时读写项目文件(如 package.json)。

import path from 'node:path'
import {
  ensureDir,
  pathExists,
  readJson as readJsonFile,
  readText,
  writeJson as writeJsonFile,
  writeText,
} from '../../utils/fs.js'
import { layoutDirs } from './paths.js'
import type { StorageService } from './storage.js'

export class FsStorageService implements StorageService {
  readonly root: string

  constructor(root: string) {
    this.root = path.resolve(root)
  }

  resolve(relPath: string): string {
    return path.resolve(this.root, relPath)
  }

  async ensureLayout(): Promise<void> {
    for (const dir of layoutDirs(this.root)) {
      await ensureDir(dir)
    }
  }

  async exists(relPath: string): Promise<boolean> {
    return pathExists(this.resolve(relPath))
  }

  async readJson<T = unknown>(relPath: string): Promise<T | undefined> {
    return readJsonFile<T>(this.resolve(relPath))
  }

  async writeJson(relPath: string, data: unknown): Promise<void> {
    await writeJsonFile(this.resolve(relPath), data)
  }

  async readText(relPath: string): Promise<string | undefined> {
    return readText(this.resolve(relPath))
  }

  async writeText(relPath: string, text: string): Promise<void> {
    await writeText(this.resolve(relPath), text)
  }
}
