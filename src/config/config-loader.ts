import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { AutoE2EConfigSchema, type AutoE2EConfig, type ProjectConfigFile } from './config-schema.js';
import { resolveConfigPaths } from './defaults.js';
import { resolveProjectPath } from './paths.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';

export const CONFIG_FILENAME = '.auto-e2e/config.yaml';
export const LEGACY_CONFIG_FILENAME = '.auto-e2e.yaml';

export interface LoadConfigOptions {
  projectRoot: string;
  configPath?: string;
}

export async function resolveConfigFile(options: LoadConfigOptions): Promise<string> {
  if (options.configPath) return resolveProjectPath(options.projectRoot, options.configPath);
  for (const name of [CONFIG_FILENAME, LEGACY_CONFIG_FILENAME]) {
    const file = path.resolve(options.projectRoot, name);
    try {
      await fs.stat(file);
      return file;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return path.resolve(options.projectRoot, CONFIG_FILENAME);
}

async function readConfigSource(options: LoadConfigOptions): Promise<unknown> {
  const file = await resolveConfigFile(options);
  let raw: unknown;
  try {
    raw = YAML.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !options.configPath) {
      raw = { project: { name: path.basename(options.projectRoot), baseUrl: 'http://127.0.0.1:3000' } };
    } else {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `无法读取配置文件 ${file}：${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  return raw;
}

export async function readConfigFile(options: LoadConfigOptions): Promise<ProjectConfigFile> {
  return validateConfig(await readConfigSource(options));
}

function validateConfig(raw: unknown): ProjectConfigFile {
  const parsed = AutoE2EConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `配置校验失败：${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  return parsed.data;
}

export async function loadConfig(options: LoadConfigOptions): Promise<AutoE2EConfig> {
  const raw = await readConfigSource(options);
  return resolveConfigPaths(validateConfig(mergeConfig(raw, process.env)), options.projectRoot);
}

function mergeConfig(raw: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const value = structuredClone(raw) as Record<string, unknown>;
  const project = objectAt(value, 'project');
  const acceptance = objectAt(value, 'acceptance');
  if (env.AUTO_E2E_PROJECT_NAME) project.name = env.AUTO_E2E_PROJECT_NAME;
  if (env.AUTO_E2E_TARGET_URL) project.baseUrl = env.AUTO_E2E_TARGET_URL;
  if (env.AUTO_E2E_MODEL) acceptance.model = env.AUTO_E2E_MODEL;
  if (env.AUTO_E2E_PROFILE) acceptance.profile = env.AUTO_E2E_PROFILE;
  return value;
}

function objectAt(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) parent[key] = {};
  return parent[key] as Record<string, unknown>;
}
