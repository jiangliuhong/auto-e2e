// Storage 抽象接口。Runtime 依赖此抽象而非具体文件系统实现,
// 对齐 AGENTS.md「优先依赖注入」与 PROVIDER_GUIDE.md「Provider 必须可替换」。
// 实现见 fs-storage.ts。

export interface StorageService {
  /** root: .auto-e2e/ 所在的项目根。 */
  readonly root: string

  /** 确保 .auto-e2e/ 完整目录布局存在。幂等。 */
  ensureLayout(): Promise<void>

  /** 文件是否存在。 */
  exists(relPath: string): Promise<boolean>

  /** 读取并解析 JSON;不存在返回 undefined。 */
  readJson<T = unknown>(relPath: string): Promise<T | undefined>

  /** 稳定写入 JSON(2 空格)。 */
  writeJson(relPath: string, data: unknown): Promise<void>

  /** 读取文本;不存在返回 undefined。 */
  readText(relPath: string): Promise<string | undefined>

  /** 写入文本。 */
  writeText(relPath: string, text: string): Promise<void>

  /** 把相对 root 的路径解析为完整路径。 */
  resolve(relPath: string): string
}
