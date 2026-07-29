/**
 * 目标项目检查（plan §16 阶段三）。
 *
 * 检查 package.json 是否存在、Playwright 是否安装/配置，返回项目元信息。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export interface ProjectInspection {
  projectRoot: string;
  hasPackageJson: boolean;
  packageName?: string;
  packageScripts: Record<string, string>;
  hasPlaywrightConfig: boolean;
  playwrightConfigFile?: string;
  playwrightInstalled: boolean;
  isNodeProject: boolean;
}

const PLAYWRIGHT_CONFIG_FILES = [
  'playwright.config.ts',
  'playwright.config.js',
  'playwright.config.mts',
  'playwright.config.mjs',
];

export interface ProjectInspectorOptions {
  projectRoot: string;
  readFile?: (file: string) => Promise<string>;
  fileExists?: (file: string) => Promise<boolean>;
}

export async function inspectProject(
  opts: ProjectInspectorOptions,
): Promise<ProjectInspection> {
  const readFile =
    opts.readFile ?? ((f) => fs.readFile(f, 'utf8'));
  const fileExists =
    opts.fileExists ??
    (async (f) => {
      try {
        await fs.access(f);
        return true;
      } catch {
        return false;
      }
    });

  const pkgPath = path.join(opts.projectRoot, 'package.json');
  let hasPackageJson = false;
  let packageName: string | undefined;
  let packageScripts: Record<string, string> = {};
  let playwrightInstalled = false;

  try {
    const content = await readFile(pkgPath);
    hasPackageJson = true;
    const pkg = JSON.parse(content) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    packageName = pkg.name;
    packageScripts = pkg.scripts ?? {};
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    playwrightInstalled =
      '@playwright/test' in allDeps || 'playwright' in allDeps || '@playwright/test-runner' in allDeps;
  } catch {
    hasPackageJson = false;
  }

  let hasPlaywrightConfig = false;
  let playwrightConfigFile: string | undefined;
  for (const candidate of PLAYWRIGHT_CONFIG_FILES) {
    if (await fileExists(path.join(opts.projectRoot, candidate))) {
      hasPlaywrightConfig = true;
      playwrightConfigFile = candidate;
      break;
    }
  }

  return {
    projectRoot: opts.projectRoot,
    hasPackageJson,
    packageName,
    packageScripts,
    hasPlaywrightConfig,
    playwrightConfigFile,
    playwrightInstalled,
    isNodeProject: hasPackageJson,
  };
}
