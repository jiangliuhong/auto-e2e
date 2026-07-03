// ScannerProvider 接口。对齐 PROVIDER_GUIDE.md「ScannerProvider」。
// 每个框架一个实现;CompositeScanner 按 detect() 顺序择优。

import type { AppMap } from '../core/models.js'

export interface ScannerProvider {
  /** 唯一标识该 provider 的名字。 */
  readonly name: string
  /** 判断该 provider 能否处理给定项目。 */
  detect(projectRoot: string): Promise<boolean>
  /** 扫描项目,返回部分 AppMap(不含 packageManager,由 composite 统一填充)。 */
  scan(projectRoot: string): Promise<Partial<AppMap>>
}
