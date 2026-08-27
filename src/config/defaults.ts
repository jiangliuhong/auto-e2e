import type { AutoE2EConfig } from './config-schema.js';
import { AutoE2EConfigSchema } from './config-schema.js';

export function defaultConfig(projectName = 'web-app'): AutoE2EConfig {
  return AutoE2EConfigSchema.parse({
    project: { name: projectName, baseUrl: 'http://127.0.0.1:3000' },
  });
}
