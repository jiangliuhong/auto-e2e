import fs from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';
import YAML from 'yaml';
import { AutoE2EConfigSchema } from '../config/config-schema.js';
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAME } from '../config/config-loader.js';
import { ACCEPTANCE_SPEC_DIRECTORY } from '../domain/task-spec.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import type { RunOptions } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';

type InitAction = 'created' | 'unchanged';

export async function workspaceInitCommand(opts: RunOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const projectRoot = ctx.projectRoot;
    const workspaceDirectory = path.join(projectRoot, '.auto-e2e');
    const configFile = path.join(projectRoot, CONFIG_FILENAME);
    const legacyConfigFile = path.join(projectRoot, LEGACY_CONFIG_FILENAME);
    const specsDirectory = path.join(projectRoot, ACCEPTANCE_SPEC_DIRECTORY);

    await requireDirectory(projectRoot, '项目根目录不存在或不是目录');
    await requireDirectoryWhenPresent(workspaceDirectory, '工作区路径已存在但不是目录');
    await requireDirectoryWhenPresent(specsDirectory, 'Spec 路径已存在但不是目录');

    const configExists = await fileExists(configFile);
    if (!configExists && await fileExists(legacyConfigFile)) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `检测到旧配置 ${legacyConfigFile}。为避免改变配置优先级，未创建 ${configFile}；请先迁移或移除旧配置`,
      );
    }
    if (configExists) await requireRegularFile(configFile, '配置路径已存在但不是普通文件');

    const specsAction: InitAction = await directoryExists(specsDirectory) ? 'unchanged' : 'created';
    const configAction: InitAction = configExists ? 'unchanged' : 'created';

    await fs.mkdir(specsDirectory, { recursive: true });
    if (!configExists) {
      const projectName = path.basename(projectRoot) || 'web-app';
      const defaults = AutoE2EConfigSchema.parse({
        project: { name: projectName, baseUrl: 'http://127.0.0.1:3000' },
      });
      const portableConfig = {
        project: defaults.project,
        acceptance: defaults.acceptance,
      };
      await fs.writeFile(configFile, YAML.stringify(portableConfig), { encoding: 'utf8', flag: 'wx' });
    }

    const relativeConfig = path.relative(projectRoot, configFile);
    const relativeSpecs = path.relative(projectRoot, specsDirectory);
    return {
      exitCode: ExitCode.Ok,
      json: {
        ok: true,
        workspace: projectRoot,
        config: { path: relativeConfig, action: configAction },
        specs: { path: relativeSpecs, action: specsAction },
      },
      message: [
        `${configAction === 'created' ? '已创建' : '已保留'}配置：${relativeConfig}`,
        `${specsAction === 'created' ? '已创建' : '已保留'} Spec 目录：${relativeSpecs}`,
      ].join('\n'),
    };
  });
}

export function registerWorkspace(program: Command): void {
  const workspace = program.command('workspace').description('管理项目的 auto-e2e 工作区');
  workspace.command('init')
    .description('创建 .auto-e2e/config.yaml 和 .auto-e2e/specs')
    .action(async (opts) => {
      process.exit(await workspaceInitCommand(mergeGlobalOpts(opts, program)));
    });
}

async function requireDirectory(target: string, message: string): Promise<void> {
  const stat = await fs.stat(target).catch((error: unknown) => {
    if (isMissing(error)) return null;
    throw error;
  });
  if (!stat?.isDirectory()) throw new AutoE2EError(ExitCode.Blocked, `${message}：${target}`);
}

async function requireDirectoryWhenPresent(target: string, message: string): Promise<void> {
  const stat = await fs.lstat(target).catch((error: unknown) => {
    if (isMissing(error)) return null;
    throw error;
  });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
    throw new AutoE2EError(ExitCode.Blocked, `${message}：${target}`);
  }
}

async function requireRegularFile(target: string, message: string): Promise<void> {
  const stat = await fs.lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new AutoE2EError(ExitCode.Blocked, `${message}：${target}`);
  }
}

async function fileExists(target: string): Promise<boolean> {
  return fs.lstat(target).then(() => true, (error: unknown) => {
    if (isMissing(error)) return false;
    throw error;
  });
}

async function directoryExists(target: string): Promise<boolean> {
  return fs.lstat(target).then((stat) => stat.isDirectory(), (error: unknown) => {
    if (isMissing(error)) return false;
    throw error;
  });
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
