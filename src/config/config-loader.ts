/**
 * 配置加载器（plan §7）。
 *
 * - 相对路径基于目标项目根目录解析。
 * - 支持环境变量覆盖（AUTO_E2E_ 前缀，扁平 key，例如 AUTO_E2E_PROJECT_BASEURL）。
 * - 配置错误时抛出 AutoE2EError(ConfigError)。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { AutoE2EConfigSchema, type AutoE2EConfig } from './config-schema.js';
import { defaultConfig } from './defaults.js';
import { AutoE2EError } from '../runtime/exit-codes.js';

export const CONFIG_FILENAME = '.auto-e2e/config.yaml';

/** 支持的环境变量覆盖映射（环境变量名 → 配置路径）。 */
const ENV_OVERRIDES: Record<string, string> = {
  AUTO_E2E_PROJECT_NAME: 'project.name',
  AUTO_E2E_PROJECT_BASEURL: 'project.baseUrl',
  AUTO_E2E_PROJECT_MANAGEAPPLICATION: 'project.manageApplication',
  AUTO_E2E_PROJECT_STARTCOMMAND: 'project.startCommand',
  AUTO_E2E_PROJECT_HEALTHURL: 'project.healthUrl',
  AUTO_E2E_PROJECT_STARTUPTIMEOUT: 'project.startupTimeout',
  AUTO_E2E_AGENT_IMPLEMENTATION: 'agent.implementation',
  AUTO_E2E_AGENT_PROVIDER: 'agent.provider',
  AUTO_E2E_AGENT_MODEL: 'agent.model',
  AUTO_E2E_BROWSER_IMPLEMENTATION: 'browser.implementation',
  AUTO_E2E_BROWSER_HEADLESS: 'browser.headless',
  AUTO_E2E_BROWSER_SESSIONPROFILE: 'browser.sessionProfile',
  AUTO_E2E_BROWSER_TIMEOUT: 'browser.timeout',
  AUTO_E2E_PLAYWRIGHT_CONFIGFILE: 'playwright.configFile',
  AUTO_E2E_PLAYWRIGHT_RETRIES: 'playwright.retries',
  AUTO_E2E_PLAYWRIGHT_WORKERS: 'playwright.workers',
};

function setPath(obj: Record<string, unknown>, dottedPath: string, value: unknown): void {
  const parts = dottedPath.split('.');
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (cursor[key] === undefined || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

/** 把环境变量字符串转换为合适的 JS 类型（数字 / 布尔 / 字符串）。 */
function coerceEnvValue(raw: string): string | number | boolean {
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

function applyEnvOverrides(obj: Record<string, unknown>, env: NodeJS.ProcessEnv): void {
  for (const [envKey, cfgPath] of Object.entries(ENV_OVERRIDES)) {
    const raw = env[envKey];
    if (raw === undefined) continue;
    setPath(obj, cfgPath, coerceEnvValue(raw));
  }
}

export interface LoadConfigOptions {
  /** 目标项目根目录。 */
  projectRoot: string;
  /** 配置文件相对/绝对路径；未提供则使用 projectRoot/.auto-e2e/config.yaml。 */
  configPath?: string;
  /** 找不到配置文件时是否回落到默认配置（init 之前）。默认 true。 */
  fallbackToDefault?: boolean;
}

/**
 * 加载并校验配置。
 * - 读取失败且未 fallback：抛 ConfigError。
 * - 校验失败：抛 ConfigError 并附带 zod 错误。
 */
export async function loadConfig(opts: LoadConfigOptions): Promise<AutoE2EConfig> {
  const filePath = opts.configPath
    ? path.resolve(opts.projectRoot, opts.configPath)
    : path.join(opts.projectRoot, CONFIG_FILENAME);

  let rawObj: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(filePath, 'utf8');
    rawObj = YAML.parse(content) as Record<string, unknown>;
  } catch (err) {
    if ((opts.fallbackToDefault ?? true) && !opts.configPath) {
      rawObj = structuredClone(defaultConfigInput());
    } else {
      throw new AutoE2EError(
        7,
        `无法读取配置文件 ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  applyEnvOverrides(rawObj, process.env);

  const parsed = AutoE2EConfigSchema.safeParse(rawObj);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new AutoE2EError(7, `配置校验失败: ${errors}`);
  }
  return parsed.data;
}

function defaultConfigInput(): Record<string, unknown> {
  // 复用 defaults 的输入对象，避免触发完整校验。
  return {
    project: {
      name: 'demo-web',
      baseUrl: 'http://127.0.0.1:3000',
      manageApplication: true,
      startCommand: 'npm run dev',
      healthUrl: 'http://127.0.0.1:3000',
    },
  };
}

export { defaultConfig };
