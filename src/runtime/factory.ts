// Runtime 工厂:装配默认 provider,返回 AutoE2ERuntime。
// 对齐 AGENTS.md「优先依赖注入」「Provider 必须可替换」。
// 第三方可通过 new DefaultRuntime(deps) 注入自定义 provider。

import path from 'node:path'
import { DefaultRuntime } from './default-runtime.js'
import { FsStorageService } from './storage/fs-storage.js'
import { LocalNodeEnvironmentProvider } from './environment/local-node-environment.js'
import { PlaywrightExecutor } from './executor/playwright-executor.js'
import {
  CompositeScanner,
  NextScannerProvider,
  ReactViteScannerProvider,
} from '../scanner/index.js'

export interface CreateRuntimeOptions {
  /** 项目根目录,默认 cwd。 */
  projectRoot?: string
}

/**
 * 创建使用默认 provider 的 Runtime。
 */
export function createRuntime(options: CreateRuntimeOptions = {}): DefaultRuntime {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const storage = new FsStorageService(projectRoot)
  const environment = new LocalNodeEnvironmentProvider({ projectRoot, storage })
  const scanner = new CompositeScanner({
    providers: [new NextScannerProvider(), new ReactViteScannerProvider()],
  })
  const executor = new PlaywrightExecutor({ projectRoot, storage })

  return new DefaultRuntime({ projectRoot, storage, environment, scanner, executor })
}
