import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config/config-loader.js';
import { autoE2EHome, workspaceId } from '../config/paths.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';

export interface WorkspaceRecord {
  id: string;
  path: string;
  name: string;
  targetUrl: string | null;
  configError: string | null;
  addedAt: string;
  lastUsedAt: string;
}

interface StoredWorkspace {
  id: string;
  path: string;
  addedAt: string;
  lastUsedAt: string;
}

interface RegistryFile {
  schemaVersion: 1;
  workspaces: StoredWorkspace[];
}

export class WorkspaceRegistry {
  readonly filePath: string;

  constructor(
    filePath = defaultRegistryPath(),
    private readonly configPathForWorkspace: (projectRoot: string) => string | undefined = () => undefined,
  ) {
    this.filePath = path.resolve(filePath);
  }

  async list(): Promise<WorkspaceRecord[]> {
    const stored = await this.read();
    const resolved: WorkspaceRecord[] = [];
    const retained: StoredWorkspace[] = [];
    for (const workspace of stored.workspaces) {
      if (!(await isDirectory(workspace.path))) continue;
      retained.push(workspace);
      const config = await loadConfig({
        projectRoot: workspace.path, configPath: this.configPathForWorkspace(workspace.path),
      }).catch(() => undefined);
      resolved.push({
        ...workspace,
        name: config?.project.name ?? path.basename(workspace.path),
        targetUrl: config?.project.baseUrl ?? null,
        configError: config ? null : '无法加载项目配置',
      });
    }
    if (retained.length !== stored.workspaces.length) {
      await this.write({ schemaVersion: 1, workspaces: retained });
    }
    return resolved.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  }

  async add(workspacePath: string): Promise<WorkspaceRecord> {
    let realPath: string;
    try {
      realPath = await fs.realpath(path.resolve(workspacePath));
    } catch (error) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `工作区不存在：${workspacePath}`,
        error,
      );
    }
    if (!(await isDirectory(realPath))) {
      throw new AutoE2EError(ExitCode.Blocked, `工作区不是目录：${realPath}`);
    }
    const stored = await this.read();
    const now = new Date().toISOString();
    const id = workspaceId(realPath);
    const existing = stored.workspaces.find((workspace) => workspace.id === id);
    if (existing) existing.lastUsedAt = now;
    else stored.workspaces.push({ id, path: realPath, addedAt: now, lastUsedAt: now });
    await this.write(stored);
    const config = await loadConfig({ projectRoot: realPath, configPath: this.configPathForWorkspace(realPath) });
    return {
      id,
      path: realPath,
      name: config.project.name,
      targetUrl: config.project.baseUrl,
      configError: null,
      addedAt: existing?.addedAt ?? now,
      lastUsedAt: now,
    };
  }

  async remove(id: string): Promise<boolean> {
    const stored = await this.read();
    const next = stored.workspaces.filter((workspace) => workspace.id !== id);
    if (next.length === stored.workspaces.length) return false;
    await this.write({ schemaVersion: 1, workspaces: next });
    return true;
  }

  async get(id: string): Promise<WorkspaceRecord> {
    const workspace = (await this.list()).find((item) => item.id === id);
    if (!workspace) throw new AutoE2EError(ExitCode.Blocked, `工作区不存在或已被删除：${id}`);
    return workspace;
  }

  private async read(): Promise<RegistryFile> {
    try {
      const raw = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Partial<RegistryFile>;
      return {
        schemaVersion: 1,
        workspaces: Array.isArray(raw.workspaces) ? raw.workspaces.filter(isStoredWorkspace) : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { schemaVersion: 1, workspaces: [] };
      }
      throw new AutoE2EError(
        ExitCode.ToolError,
        `无法读取工作区注册表：${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  private async write(registry: RegistryFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, this.filePath);
  }
}

export function defaultRegistryPath(): string {
  return path.join(autoE2EHome(), 'workspaces.json');
}

async function isDirectory(candidate: string): Promise<boolean> {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return ['id', 'path', 'addedAt', 'lastUsedAt'].every((key) => typeof item[key] === 'string');
}
