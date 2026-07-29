/**
 * 配置与示例文件写入工具，供 init 命令使用。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type { AutoE2EConfig } from './config-schema.js';

/** 把配置对象序列化为可读 YAML（用于落盘到 .auto-e2e/config.yaml）。 */
export function configToYaml(config: AutoE2EConfig): string {
  return YAML.stringify(config);
}

export const EXAMPLE_TASK_SPEC = {
  taskId: 'TASK-20260729-001',
  title: '新增用户禁用功能',
  requirement: '管理员可以在用户列表禁用用户，禁用后用户不能登录。',
  acceptanceCriteria: [
    '用户列表展示禁用按钮',
    '点击禁用后需要二次确认',
    '禁用成功后状态显示为已禁用',
    '已禁用用户不能登录',
    '取消确认时不得修改用户状态',
  ],
  changedFiles: [
    'src/pages/users/index.tsx',
    'src/api/users.ts',
    'server/controllers/user.ts',
  ],
  changedRoutes: ['/users', '/login'],
  changedApis: ['PUT /api/users/:id/disable'],
  riskHints: ['用户状态缓存可能未刷新', '禁用接口可能缺少权限校验'],
  startCommand: 'npm run dev',
  baseUrl: 'http://127.0.0.1:3000',
};

export const GITIGNORE_ENTRIES = [
  '.auto-e2e/auth/',
  '.auto-e2e/artifacts/',
  '.auto-e2e/reports/',
  '.auto-e2e/generated/',
];

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * 在目标项目写入初始化产物。
 * 返回写入的文件/目录列表，用于报告。
 */
export interface InitArtifact {
  configPath: string;
  taskSpecPath: string;
  gitignoreUpdated: boolean;
  createdDirs: string[];
}

export interface InitWriterOptions {
  projectRoot: string;
  config: AutoE2EConfig;
  force?: boolean;
  /** 注入的写文件实现，便于测试。 */
  writeFile?: (file: string, data: string) => Promise<void>;
  mkdir?: (dir: string) => Promise<void>;
  readFile?: (file: string) => Promise<string>;
}

export async function writeInitArtifacts(
  opts: InitWriterOptions,
): Promise<InitArtifact> {
  const writeFile = opts.writeFile ?? ((f, d) => fs.writeFile(f, d, 'utf8'));
  const mkdir = opts.mkdir ?? ensureDir;
  const readFile = opts.readFile ?? ((f) => fs.readFile(f, 'utf8'));

  const autoE2eDir = path.join(opts.projectRoot, '.auto-e2e');
  const configPath = path.join(autoE2eDir, 'config.yaml');
  const taskSpecPath = path.join(autoE2eDir, 'task-spec.json');

  const createdDirs = [
    autoE2eDir,
    path.join(autoE2eDir, 'generated'),
    path.join(autoE2eDir, 'reports'),
    path.join(autoE2eDir, 'artifacts'),
    path.join(autoE2eDir, 'auth'),
  ];

  // --force 才覆盖已存在的 config.yaml。
  if (!opts.force) {
    let exists = false;
    try {
      await readFile(configPath);
      exists = true;
    } catch {
      exists = false;
    }
    if (exists) {
      throw new Error(`配置文件已存在: ${configPath}（使用 --force 覆盖）`);
    }
  }

  for (const dir of createdDirs) {
    await mkdir(dir);
  }

  await writeFile(configPath, configToYaml(opts.config));
  await writeFile(taskSpecPath, JSON.stringify(EXAMPLE_TASK_SPEC, null, 2) + '\n');

  // 更新 .gitignore（幂等追加缺失条目）。
  const gitignorePath = path.join(opts.projectRoot, '.gitignore');
  let gitignoreUpdated = false;
  let existing = '';
  try {
    existing = await readFile(gitignorePath);
  } catch {
    existing = '';
  }
  const lines = existing ? existing.split('\n') : [];
  const missing = GITIGNORE_ENTRIES.filter((entry) => !lines.includes(entry));
  if (missing.length > 0) {
    const addition = (existing && !existing.endsWith('\n') ? '\n' : '') + missing.join('\n') + '\n';
    await writeFile(gitignorePath, existing + addition);
    gitignoreUpdated = true;
  }

  return { configPath, taskSpecPath, gitignoreUpdated, createdDirs };
}
