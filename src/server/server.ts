import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { executeAcceptance } from '../acceptance/acceptance-runner.js';
import { AcceptanceHistoryStore } from '../acceptance/history-store.js';
import { CONFIG_FILENAME, loadConfig } from '../config/config-loader.js';
import { AutoE2EConfigSchema, type AutoE2EConfig } from '../config/config-schema.js';
import {
  ACCEPTANCE_SPEC_DIRECTORY,
  isAcceptanceSpecFileName,
  TaskSpecSchema,
  type TaskSpec,
} from '../domain/task-spec.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { Logger } from '../runtime/logger.js';
import { WorkspaceRegistry } from '../workspace/workspace-registry.js';
import { renderDashboardHtml } from './web-ui.js';

export interface AutoE2EServerOptions {
  projectRoot?: string;
  registerProjectRoot?: boolean;
  registryPath?: string;
  port?: number;
  host?: string;
  logger?: Logger;
}

export interface AutoE2EServerInstance {
  server: http.Server;
  readonly port: number;
  readonly host: string;
  readonly url: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createAutoE2EServer(options: AutoE2EServerOptions): AutoE2EServerInstance {
  const host = options.host ?? '127.0.0.1';
  const requestedPort = options.port ?? 4317;
  const logger = options.logger ?? new Logger({ level: 'info' });
  const registry = new WorkspaceRegistry(options.registryPath);
  let actualPort = requestedPort;

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${actualPort}`}`);
    const method = request.method?.toUpperCase() ?? 'GET';
    try {
      if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        send(response, 200, renderDashboardHtml(), 'text/html; charset=utf-8');
        return;
      }

      if (method === 'GET' && url.pathname === '/api/status') {
        sendJson(response, 200, { ok: true, version: '0.3.0', workspaceCount: (await registry.list()).length });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/workspaces') {
        sendJson(response, 200, { ok: true, workspaces: await registry.list() });
        return;
      }

      if (method === 'POST' && url.pathname === '/api/workspaces') {
        const body = await parseJsonBody(request);
        const workspacePath = stringValue(body.path);
        if (!workspacePath) throw new AutoE2EError(ExitCode.Blocked, 'path 不能为空');
        sendJson(response, 201, { ok: true, workspace: await registry.add(workspacePath) });
        return;
      }

      const workspaceMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)(?:\/(.*))?$/);
      if (workspaceMatch?.[1]) {
        const workspaceId = decodeURIComponent(workspaceMatch[1]);
        const action = workspaceMatch[2] ?? '';
        if (method === 'DELETE' && !action) {
          sendJson(response, 200, { ok: await registry.remove(workspaceId) });
          return;
        }
        const workspace = await registry.get(workspaceId);
        const config = await loadConfig({ projectRoot: workspace.path });
        const store = new AcceptanceHistoryStore(workspace.path, config.acceptance.databasePath);

        if (method === 'GET' && !action) {
          sendJson(response, 200, { ok: true, workspace, config });
          return;
        }
        if (method === 'PUT' && action === 'config') {
          const body = await parseJsonBody(request);
          const parsed = AutoE2EConfigSchema.safeParse(body.config);
          if (!parsed.success) {
            throw new AutoE2EError(ExitCode.Blocked, parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
          }
          await writeConfigFile(workspace.path, parsed.data);
          sendJson(response, 200, { ok: true, config: parsed.data });
          return;
        }
        if (method === 'GET' && action === 'task-specs') {
          sendJson(response, 200, { ok: true, specs: await listTaskSpecs(workspace.path) });
          return;
        }
        const taskSpecMatch = action.match(/^task-specs\/([^/]+)$/);
        if (taskSpecMatch?.[1]) {
          const fileName = decodeURIComponent(taskSpecMatch[1]);
          if (method === 'GET') {
            sendJson(response, 200, { ok: true, fileName, spec: await readNamedTaskSpec(workspace.path, fileName) });
            return;
          }
          if (method === 'PUT') {
            const body = await parseJsonBody(request);
            const parsed = TaskSpecSchema.safeParse(body.spec);
            if (!parsed.success) {
              throw new AutoE2EError(ExitCode.Blocked, parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
            }
            await writeNamedTaskSpec(workspace.path, fileName, parsed.data);
            sendJson(response, 200, { ok: true, fileName, spec: parsed.data });
            return;
          }
          if (method === 'DELETE') {
            await deleteNamedTaskSpec(workspace.path, fileName);
            sendJson(response, 200, { ok: true });
            return;
          }
        }
        if (method === 'GET' && action === 'runs') {
          const rawLimit = Number(url.searchParams.get('limit') ?? 100);
          const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 100;
          sendJson(response, 200, { ok: true, runs: await store.list(limit) });
          return;
        }
        if (method === 'POST' && action === 'runs') {
          const body = await parseJsonBody(request);
          const run = await executeAcceptance({
            projectRoot: workspace.path,
            config,
            spec: stringValue(body.spec),
            requirement: stringValue(body.requirement),
            change: stringValue(body.change),
            url: stringValue(body.url),
            profile: stringValue(body.profile),
            model: stringValue(body.model),
            headed: body.headed === true,
            fresh: body.fresh === true,
            logger,
          });
          sendJson(response, 200, { ok: run.status === 'passed', run });
          return;
        }
        const runMatch = action.match(/^runs\/([^/]+)$/);
        if (method === 'GET' && runMatch?.[1]) {
          const run = await store.get(decodeURIComponent(runMatch[1]));
          if (!run) sendJson(response, 404, { ok: false, error: '未找到运行记录' });
          else sendJson(response, 200, { ok: true, run });
          return;
        }
        const artifactMatch = action.match(/^artifacts\/(.+)$/);
        if (method === 'GET' && artifactMatch?.[1]) {
          await serveArtifact(
            response,
            workspace.path,
            config.report.artifactDirectory,
            decodeURIComponent(artifactMatch[1]),
          );
          return;
        }
      }

      sendJson(response, 404, { ok: false, error: 'Not Found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, error instanceof AutoE2EError ? 400 : 500, { ok: false, error: message });
    }
  });

  return {
    server,
    get port() { return actualPort; },
    host,
    get url() { return `http://${host}:${actualPort}`; },
    async start() {
      if (options.projectRoot && (
        options.registerProjectRoot || await hasWorkspaceMarker(options.projectRoot)
      )) {
        await registry.add(options.projectRoot);
      }
      await registry.list();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(requestedPort, host, () => {
          server.off('error', reject);
          const address = server.address();
          if (address && typeof address === 'object') actualPort = address.port;
          resolve();
        });
      });
      logger.info(`验收报告服务已启动：http://${host}:${actualPort}`);
    },
    async stop() {
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}

interface TaskSpecListItem {
  fileName: string;
  reference: string;
  taskId: string | null;
  title: string;
  error: string | null;
}

async function listTaskSpecs(projectRoot: string): Promise<TaskSpecListItem[]> {
  const directory = path.join(projectRoot, ACCEPTANCE_SPEC_DIRECTORY);
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const fileNames = entries
    .filter((entry) => entry.isFile() && isAcceptanceSpecFileName(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(fileNames.map(async (fileName) => {
    const raw = await readNamedTaskSpec(projectRoot, fileName);
    const parsed = TaskSpecSchema.safeParse(raw);
    return {
      fileName,
      reference: path.join(ACCEPTANCE_SPEC_DIRECTORY, fileName),
      taskId: parsed.success ? parsed.data.taskId ?? null : null,
      title: parsed.success ? parsed.data.title : fileName,
      error: parsed.success
        ? null
        : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    };
  }));
}

async function readNamedTaskSpec(projectRoot: string, fileName: string): Promise<unknown> {
  const target = resolveNamedTaskSpec(projectRoot, fileName);
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(target, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new AutoE2EError(ExitCode.Blocked, `验收用例不存在：${fileName}`);
    }
    throw error;
  }
  return raw;
}

async function writeNamedTaskSpec(
  projectRoot: string,
  fileName: string,
  spec: TaskSpec,
): Promise<void> {
  const target = resolveNamedTaskSpec(projectRoot, fileName);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function deleteNamedTaskSpec(projectRoot: string, fileName: string): Promise<void> {
  const target = resolveNamedTaskSpec(projectRoot, fileName);
  try {
    await fs.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function resolveNamedTaskSpec(projectRoot: string, fileName: string): string {
  if (!isAcceptanceSpecFileName(fileName)) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `验收用例文件名必须匹配 *.spec.json：${fileName}`,
    );
  }
  return path.join(projectRoot, ACCEPTANCE_SPEC_DIRECTORY, fileName);
}

async function writeConfigFile(projectRoot: string, config: AutoE2EConfig): Promise<void> {
  const target = path.join(projectRoot, CONFIG_FILENAME);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${YAML.stringify(config)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function hasWorkspaceMarker(projectRoot: string): Promise<boolean> {
  for (const marker of ['.auto-e2e.yaml', ACCEPTANCE_SPEC_DIRECTORY]) {
    try {
      await fs.access(path.join(projectRoot, marker));
      return true;
    } catch { /* continue */ }
  }
  return false;
}

function sendJson(response: http.ServerResponse, status: number, value: unknown): void {
  send(response, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

function send(response: http.ServerResponse, status: number, body: string | Buffer, type: string): void {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

async function parseJsonBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy(new Error('请求体超过 1 MB'));
    });
    request.on('end', () => {
      try {
        const parsed: unknown = body ? JSON.parse(body) : {};
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('请求体必须是 JSON 对象'));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

async function serveArtifact(
  response: http.ServerResponse,
  projectRoot: string,
  artifactDirectory: string,
  relative: string,
): Promise<void> {
  const root = path.resolve(projectRoot, artifactDirectory);
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    sendJson(response, 400, { ok: false, error: '非法 artifact 路径' });
    return;
  }
  try {
    const content = await fs.readFile(file);
    const extension = path.extname(file).toLowerCase();
    const type = extension === '.png' ? 'image/png'
      : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg'
        : 'application/octet-stream';
    send(response, 200, content, type);
  } catch {
    sendJson(response, 404, { ok: false, error: 'Artifact 不存在' });
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
