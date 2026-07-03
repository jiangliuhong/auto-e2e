// 文件系统工具:基于 fs-extra 的薄封装。
// 提供 JSON 稳定序列化(2 空格,确定性)与安全的读写。

import fse from 'fs-extra'
import path from 'node:path'

/** 确保 dir 存在(含父级)。 */
export async function ensureDir(dir: string): Promise<void> {
  await fse.ensureDir(dir)
}

/** 判断路径是否存在。 */
export async function pathExists(p: string): Promise<boolean> {
  return fse.pathExists(p)
}

/** 读取并解析 JSON 文件;文件不存在时返回 undefined(不抛错)。 */
export async function readJson<T = unknown>(file: string): Promise<T | undefined> {
  if (!(await fse.pathExists(file))) return undefined
  const buf = await fse.readFile(file, 'utf8')
  return JSON.parse(buf) as T
}

/**
 * 写入 JSON 文件,使用稳定的 2 空格序列化,保证确定性。
 * 会自动创建父级目录。
 */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await fse.ensureDir(path.dirname(file))
  const text = JSON.stringify(data, null, 2) + '\n'
  await fse.writeFile(file, text, 'utf8')
}

/** 读取文本文件;文件不存在时返回 undefined。 */
export async function readText(file: string): Promise<string | undefined> {
  if (!(await fse.pathExists(file))) return undefined
  return fse.readFile(file, 'utf8')
}

/**
 * 写入文本文件。
 * 会自动创建父级目录。
 */
export async function writeText(file: string, text: string): Promise<void> {
  await fse.ensureDir(path.dirname(file))
  await fse.writeFile(file, text, 'utf8')
}
