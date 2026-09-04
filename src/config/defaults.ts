import type { AutoE2EConfig, ProjectConfigFile } from './config-schema.js';
import { AutoE2EConfigSchema } from './config-schema.js';
import { defaultStoragePaths, resolveProjectPath } from './paths.js';

export function defaultConfig(projectName = 'web-app', projectRoot = process.cwd()): AutoE2EConfig {
  return resolveConfigPaths(AutoE2EConfigSchema.parse({
    project: { name: projectName, baseUrl: 'http://127.0.0.1:3000' },
  }), projectRoot);
}

export function resolveConfigPaths(config: ProjectConfigFile, projectRoot: string): AutoE2EConfig {
  const defaults = defaultStoragePaths(projectRoot);
  return {
    ...config,
    acceptance: {
      ...config.acceptance,
      databasePath: resolveProjectPath(projectRoot, config.acceptance.databasePath ?? defaults.databasePath),
    },
    report: {
      ...config.report,
      outputDirectory: resolveProjectPath(projectRoot, config.report.outputDirectory ?? defaults.outputDirectory),
      artifactDirectory: resolveProjectPath(projectRoot, config.report.artifactDirectory ?? defaults.artifactDirectory),
    },
  };
}
