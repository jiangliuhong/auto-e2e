// Config schema 与默认值。
// init 写入默认 config.json;doctor 验证其有效性。
// 使用 zod 校验,对齐 AGENTS.md「避免 any」「显式断言」。

import { z } from 'zod'
import type { Config } from '../core/models.js'

export const ConfigSchema = z
  .object({
    baseUrl: z.string().url().optional(),
    devCommand: z.string().optional(),
    playwrightConfig: z.string().optional(),
    browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
    viewport: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .optional(),
    storageState: z.string().optional(),
    agentPlatform: z.enum(['codex', 'claude', 'zcode']).optional(),
  })
  .strict()

/** 默认 config.json 内容。 */
export function defaultConfig(): Config {
  return {
    baseUrl: 'http://localhost:3000',
    playwrightConfig: 'playwright.config.ts',
    browser: 'chromium',
    viewport: { width: 1280, height: 720 },
  }
}

/** 校验并解析 config 对象;失败时抛出 ZodError(由调用方归一化为 RuntimeError)。 */
export function parseConfig(raw: unknown): Config {
  return ConfigSchema.parse(raw) as Config
}
