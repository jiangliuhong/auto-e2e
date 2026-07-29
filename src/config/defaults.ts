/**
 * 配置默认值与示例配置生成（用于 `auto-e2e init`）。
 */
import type { AutoE2EConfig } from './config-schema.js';
import { AutoE2EConfigSchema } from './config-schema.js';

/** init 写入的默认配置（基于本地常见 Web 项目）。 */
export const DEFAULT_CONFIG_INPUT = {
  project: {
    name: 'demo-web',
    baseUrl: 'http://127.0.0.1:3000',
    startCommand: 'npm run dev',
    healthUrl: 'http://127.0.0.1:3000',
  },
};

export function defaultConfig(): AutoE2EConfig {
  return AutoE2EConfigSchema.parse(DEFAULT_CONFIG_INPUT);
}
