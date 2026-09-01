import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Duplex } from 'node:stream';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {
  BetterWrightCli,
  type BetterWrightLiveViewSession,
  type BetterWrightManualLoginSession,
} from '../acceptance/betterwright-cli.js';
import { executeAcceptance } from '../acceptance/acceptance-runner.js';
import type { AcceptanceRun } from '../domain/acceptance-run.js';
import { AcceptanceHistoryStore } from '../acceptance/history-store.js';
import { validateTargetUrl } from '../acceptance/preflight.js';
import { CONFIG_FILENAME, loadConfig } from '../config/config-loader.js';
import {
  AcceptanceConfigSchema,
  AutoE2EConfigSchema,
  type AutoE2EConfig,
} from '../config/config-schema.js';
import {
  ACCEPTANCE_SPEC_DIRECTORY,
  isAcceptanceSpecFileName,
  validateTaskSpec,
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
  betterwrightBinary?: string;
}

export interface AutoE2EServerInstance {
  server: http.Server;
  readonly port: number;
  readonly host: string;
  readonly url: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

type RunJobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface RunJobEvent {
  eventId?: number;
  type: string;
  [key: string]: unknown;
}

interface RunJob {
  id: string;
  workspaceId: string;
  status: RunJobStatus;
  events: RunJobEvent[];
  listeners: Set<http.ServerResponse>;
  run?: AcceptanceRun;
  error?: string;
  controller: AbortController;
  promise?: Promise<void>;
}

interface LiveViewProxyTarget {
  workspaceId: string;
  upstream: URL;
}

export function createAutoE2EServer(options: AutoE2EServerOptions): AutoE2EServerInstance {
  const host = options.host ?? '127.0.0.1';
  const requestedPort = options.port ?? 4317;
  const logger = options.logger ?? new Logger({ level: 'info' });
  const registry = new WorkspaceRegistry(options.registryPath);
  const manualLoginSessions = new Map<string, BetterWrightManualLoginSession>();
  const runLiveViewSessions = new Map<string, BetterWrightLiveViewSession>();
  const runJobs = new Map<string, RunJob>();
  const activeRunJobs = new Map<string, string>();
  const liveViewProxyTargets = new Map<string, LiveViewProxyTarget>();
  const workspaceLiveViewHandles = new Map<string, string>();
  const liveViewSockets = new Set<Duplex>();
  let actualPort = requestedPort;
  let stopping = false;

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${actualPort}`}`);
    const method = request.method?.toUpperCase() ?? 'GET';
    try {
      if (stopping) {
        sendJson(response, 503, { ok: false, error: '服务正在关闭' });
        return;
      }
      if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        send(response, 200, renderDashboardHtml(), 'text/html; charset=utf-8');
        return;
      }

      const liveViewMatch = url.pathname.match(/^\/api\/live-views\/([^/]+)\/?$/);
      if (method === 'GET' && liveViewMatch?.[1]) {
        const target = liveViewProxyTargets.get(decodeURIComponent(liveViewMatch[1]));
        if (!target) {
          sendJson(response, 404, { ok: false, error: 'Live View 已失效' });
          return;
        }
        await proxyLiveViewPage(response, target.upstream);
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
          await cancelRunJob(activeRunJobs.get(workspaceId), runJobs);
          await manualLoginSessions.get(workspaceId)?.close();
          manualLoginSessions.delete(workspaceId);
          await runLiveViewSessions.get(workspaceId)?.close();
          runLiveViewSessions.delete(workspaceId);
          removeLiveViewProxy(workspaceId, liveViewProxyTargets, workspaceLiveViewHandles);
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
            const parsed = validateTaskSpec(body.spec);
            if (!parsed.success || !parsed.spec) {
              throw new AutoE2EError(ExitCode.Blocked, parsed.errors.join('; '));
            }
            await writeNamedTaskSpec(workspace.path, fileName, parsed.spec);
            sendJson(response, 200, { ok: true, fileName, spec: parsed.spec });
            return;
          }
          if (method === 'DELETE') {
            await deleteNamedTaskSpec(workspace.path, fileName);
            sendJson(response, 200, { ok: true });
            return;
          }
        }
        const taskResourceMatch = action.match(/^task-specs\/([^/]+)\/resources(?:\/([^/]+))?$/);
        if (taskResourceMatch?.[1]) {
          const fileName = decodeURIComponent(taskResourceMatch[1]);
          const resourcePath = taskResourceMatch[2]
            ? decodeURIComponent(taskResourceMatch[2])
            : undefined;
          if (method === 'GET' && !resourcePath) {
            sendJson(response, 200, {
              ok: true,
              files: await listBundleResources(workspace.path, fileName),
            });
            return;
          }
          if (method === 'PUT' && resourcePath) {
            const content = await readBinaryBody(request, 100 * 1024 * 1024);
            await writeBundleResource(workspace.path, fileName, resourcePath, content);
            sendJson(response, 200, { ok: true, path: resourcePath, size: content.length });
            return;
          }
          if (method === 'DELETE' && resourcePath) {
            await deleteBundleResource(workspace.path, fileName, resourcePath);
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
        if (method === 'POST' && action === 'manual-login') {
          const activeJob = runJobs.get(activeRunJobs.get(workspaceId) ?? '');
          if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'running')) {
            sendJson(response, 409, { ok: false, error: '验收运行期间不能切换到手动登录' });
            return;
          }
          const body = await parseJsonBody(request);
          const targetUrl = validateTargetUrl(stringValue(body.url) ?? config.project.baseUrl);
          const profileResult = AcceptanceConfigSchema.shape.profile.safeParse(
            stringValue(body.profile) ?? config.acceptance.profile,
          );
          if (!profileResult.success) {
            throw new AutoE2EError(
              ExitCode.Blocked,
              `Profile 无效：${profileResult.error.issues.map((issue) => issue.message).join('; ')}`,
            );
          }
          const previous = manualLoginSessions.get(workspaceId);
          if (previous) await previous.close();
          manualLoginSessions.delete(workspaceId);
          await runLiveViewSessions.get(workspaceId)?.close();
          runLiveViewSessions.delete(workspaceId);
          removeLiveViewProxy(workspaceId, liveViewProxyTargets, workspaceLiveViewHandles);
          const manualLogin = await new BetterWrightCli({
            binary: options.betterwrightBinary,
            cwd: workspace.path,
            logger,
          }).startManualLogin({
            targetUrl,
            profile: profileResult.data,
            session: manualLoginSessionName(config.project.name),
            headed: typeof body.headed === 'boolean'
              ? body.headed
              : config.acceptance.headed,
          });
          manualLoginSessions.set(workspaceId, manualLogin);
          const viewerUrl = registerLiveViewProxy(
            workspaceId,
            manualLogin.viewerUrl,
            liveViewProxyTargets,
            workspaceLiveViewHandles,
          );
          sendJson(response, 200, {
            ok: true,
            viewerUrl,
            targetUrl,
            profile: profileResult.data,
          });
          return;
        }
        if (method === 'POST' && action === 'run-jobs') {
          const activeJobId = activeRunJobs.get(workspaceId);
          const activeJob = activeJobId ? runJobs.get(activeJobId) : undefined;
          if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'running')) {
            sendJson(response, 409, { ok: false, error: '当前工作区已有验收任务正在运行' });
            return;
          }
          const body = await parseJsonBody(request);
          const job: RunJob = {
            id: randomUUID(),
            workspaceId,
            status: 'queued',
            events: [],
            listeners: new Set(),
            controller: new AbortController(),
          };
          runJobs.set(job.id, job);
          activeRunJobs.set(workspaceId, job.id);
          sendJson(response, 202, { ok: true, jobId: job.id, status: job.status });
          job.promise = runAcceptanceJob({
              job,
              workspacePath: workspace.path,
              config,
              body,
              logger,
              betterwrightBinary: options.betterwrightBinary,
              manualLoginSessions,
              runLiveViewSessions,
              runJobs,
              activeRunJobs,
              liveViewProxyTargets,
              workspaceLiveViewHandles,
            });
          return;
        }
        if (method === 'GET' && action === 'run-jobs/active') {
          const jobId = activeRunJobs.get(workspaceId);
          const job = jobId ? runJobs.get(jobId) : undefined;
          sendJson(response, 200, {
            ok: true,
            job: job && (job.status === 'queued' || job.status === 'running')
              ? { id: job.id, status: job.status }
              : null,
          });
          return;
        }
        const runJobMatch = action.match(/^run-jobs\/([^/]+)(?:\/(events))?$/);
        if (method === 'GET' && runJobMatch?.[1]) {
          const job = runJobs.get(decodeURIComponent(runJobMatch[1]));
          if (!job || job.workspaceId !== workspaceId) {
            sendJson(response, 404, { ok: false, error: '未找到运行任务' });
            return;
          }
          if (runJobMatch[2] === 'events') {
            openRunJobEvents(request, response, job);
          } else {
            sendJson(response, 200, {
              ok: true,
              job: { id: job.id, status: job.status, run: job.run, error: job.error },
            });
          }
          return;
        }
        if (method === 'POST' && action === 'runs') {
          const body = await parseJsonBody(request);
          const run = await executeAcceptance({
            projectRoot: workspace.path,
            config,
            spec: stringValue(body.spec),
            url: stringValue(body.url),
            profile: stringValue(body.profile),
            model: stringValue(body.model),
            headed: body.headed === true,
            fresh: body.fresh === true,
            logger,
            betterwrightBinary: options.betterwrightBinary,
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

  server.on('upgrade', (request, socket, head) => {
    liveViewSockets.add(socket);
    socket.once('close', () => liveViewSockets.delete(socket));
    proxyLiveViewWebSocket(
      request,
      socket,
      head,
      liveViewProxyTargets,
    );
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
      stopping = true;
      const activeJobs = [...activeRunJobs.values()]
        .map((jobId) => runJobs.get(jobId))
        .filter((job): job is RunJob => Boolean(job));
      for (const job of activeJobs) job.controller.abort();
      await Promise.allSettled(activeJobs.map((job) => job.promise));
      await Promise.all([...manualLoginSessions.values()].map((session) => session.close()));
      manualLoginSessions.clear();
      await Promise.all([...runLiveViewSessions.values()].map((session) => session.close()));
      runLiveViewSessions.clear();
      liveViewProxyTargets.clear();
      workspaceLiveViewHandles.clear();
      for (const job of runJobs.values()) {
        for (const listener of job.listeners) listener.end();
        job.listeners.clear();
      }
      for (const socket of liveViewSockets) socket.destroy();
      liveViewSockets.clear();
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}

async function runAcceptanceJob(input: {
  job: RunJob;
  workspacePath: string;
  config: AutoE2EConfig;
  body: Record<string, unknown>;
  logger: Logger;
  betterwrightBinary?: string;
  manualLoginSessions: Map<string, BetterWrightManualLoginSession>;
  runLiveViewSessions: Map<string, BetterWrightLiveViewSession>;
  runJobs: Map<string, RunJob>;
  activeRunJobs: Map<string, string>;
  liveViewProxyTargets: Map<string, LiveViewProxyTarget>;
  workspaceLiveViewHandles: Map<string, string>;
}): Promise<void> {
  const { job } = input;
  job.status = 'running';
  emitRunJobEvent(job, { type: 'run-started' });
  try {
    const run = await executeAcceptance({
      projectRoot: input.workspacePath,
      config: input.config,
      spec: stringValue(input.body.spec),
      url: stringValue(input.body.url),
      profile: stringValue(input.body.profile),
      model: stringValue(input.body.model),
      headed: input.body.headed === true,
      fresh: input.body.fresh === true,
      logger: input.logger,
      betterwrightBinary: input.betterwrightBinary,
      signal: job.controller.signal,
      lifecycle: {
        onCaseStarting: async (context) => {
          emitRunJobEvent(job, {
            type: 'case-started',
            caseId: context.caseId,
            title: context.title,
            index: context.index,
            total: context.total,
          });
          await input.manualLoginSessions.get(job.workspaceId)?.close();
          input.manualLoginSessions.delete(job.workspaceId);
          await input.runLiveViewSessions.get(job.workspaceId)?.close();
          input.runLiveViewSessions.delete(job.workspaceId);
          removeLiveViewProxy(
            job.workspaceId,
            input.liveViewProxyTargets,
            input.workspaceLiveViewHandles,
          );
          try {
            const viewer = await new BetterWrightCli({
              binary: input.betterwrightBinary,
              cwd: input.workspacePath,
              logger: input.logger,
            }).startLiveView({
              profile: context.profile,
              session: context.session,
              headed: input.body.headed === true,
              signal: job.controller.signal,
            });
            input.runLiveViewSessions.set(job.workspaceId, viewer);
            const viewerUrl = registerLiveViewProxy(
              job.workspaceId,
              viewer.viewerUrl,
              input.liveViewProxyTargets,
              input.workspaceLiveViewHandles,
            );
            emitRunJobEvent(job, {
              type: 'viewer-ready',
              viewerUrl,
              caseId: context.caseId,
              title: context.title,
            });
          } catch (error) {
            emitRunJobEvent(job, {
              type: 'viewer-error',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
        onCaseCompleted: (context, result) => {
          emitRunJobEvent(job, {
            type: 'case-completed',
            caseId: context.caseId,
            title: context.title,
            status: result.status,
          });
        },
      },
    });
    job.run = run;
    job.status = 'completed';
    emitRunJobEvent(job, { type: 'run-completed', run });
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    emitRunJobEvent(job, { type: 'run-failed', error: job.error });
  } finally {
    if (input.activeRunJobs.get(job.workspaceId) === job.id) {
      input.activeRunJobs.delete(job.workspaceId);
    }
    const cleanup = setTimeout(() => input.runJobs.delete(job.id), 5 * 60_000);
    cleanup.unref();
  }
}

async function cancelRunJob(
  jobId: string | undefined,
  jobs: Map<string, RunJob>,
): Promise<void> {
  const job = jobId ? jobs.get(jobId) : undefined;
  if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
  job.controller.abort();
  await job.promise;
}

function registerLiveViewProxy(
  workspaceId: string,
  viewerUrl: string,
  targets: Map<string, LiveViewProxyTarget>,
  workspaceHandles: Map<string, string>,
): string {
  const upstream = new URL(viewerUrl);
  if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname)) {
    throw new AutoE2EError(ExitCode.Blocked, 'BetterWright Live View 必须监听本机 HTTP 地址');
  }
  removeLiveViewProxy(workspaceId, targets, workspaceHandles);
  const handle = randomUUID();
  targets.set(handle, { workspaceId, upstream });
  workspaceHandles.set(workspaceId, handle);
  return `/api/live-views/${encodeURIComponent(handle)}/?t=${encodeURIComponent(handle)}`;
}

function removeLiveViewProxy(
  workspaceId: string,
  targets: Map<string, LiveViewProxyTarget>,
  workspaceHandles: Map<string, string>,
): void {
  const handle = workspaceHandles.get(workspaceId);
  if (handle) targets.delete(handle);
  workspaceHandles.delete(workspaceId);
}

async function proxyLiveViewPage(response: http.ServerResponse, upstream: URL): Promise<void> {
  const upstreamResponse = await fetch(upstream, {
    headers: { Accept: 'text/html' },
    redirect: 'error',
  });
  if (!upstreamResponse.ok) {
    sendJson(response, 502, { ok: false, error: `Live View 返回 HTTP ${upstreamResponse.status}` });
    return;
  }
  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  response.writeHead(200, {
    'Content-Type': upstreamResponse.headers.get('content-type') ?? 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function proxyLiveViewWebSocket(
  request: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  targets: Map<string, LiveViewProxyTarget>,
): void {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
  const handle = requestUrl.pathname === '/ws' ? requestUrl.searchParams.get('t') : null;
  const target = handle ? targets.get(handle) : undefined;
  if (!target) {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return;
  }
  const upstreamPath = `/ws${target.upstream.search}`;
  const upstreamRequest = http.request({
    protocol: target.upstream.protocol,
    hostname: target.upstream.hostname,
    port: target.upstream.port,
    path: upstreamPath,
    method: 'GET',
    headers: {
      Connection: 'Upgrade',
      Upgrade: 'websocket',
      Origin: target.upstream.origin,
      ...(request.headers['sec-websocket-key'] ? { 'Sec-WebSocket-Key': request.headers['sec-websocket-key'] } : {}),
      ...(request.headers['sec-websocket-version'] ? { 'Sec-WebSocket-Version': request.headers['sec-websocket-version'] } : {}),
      ...(request.headers['sec-websocket-extensions'] ? { 'Sec-WebSocket-Extensions': request.headers['sec-websocket-extensions'] } : {}),
      ...(request.headers['sec-websocket-protocol'] ? { 'Sec-WebSocket-Protocol': request.headers['sec-websocket-protocol'] } : {}),
    },
  });
  upstreamRequest.on('upgrade', (upstreamResponse, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(upstreamResponse.headers)
      .flatMap(([name, value]) => value === undefined ? [] : [`${name}: ${Array.isArray(value) ? value.join(', ') : value}`]);
    socket.write(`HTTP/1.1 ${upstreamResponse.statusCode ?? 101} Switching Protocols\r\n${headers.join('\r\n')}\r\n\r\n`);
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.on('error', () => socket.destroy());
    socket.on('error', () => upstreamSocket.destroy());
    socket.pipe(upstreamSocket).pipe(socket);
  });
  upstreamRequest.on('response', (upstreamResponse) => {
    socket.end(`HTTP/1.1 ${upstreamResponse.statusCode ?? 502} Bad Gateway\r\nConnection: close\r\n\r\n`);
  });
  upstreamRequest.on('error', () => socket.destroy());
  upstreamRequest.end();
}

function emitRunJobEvent(job: RunJob, event: RunJobEvent): void {
  const storedEvent = { ...event, eventId: job.events.length + 1 };
  job.events.push(storedEvent);
  const payload = `id: ${storedEvent.eventId}\ndata: ${JSON.stringify(storedEvent)}\n\n`;
  for (const listener of job.listeners) listener.write(payload);
  if (event.type === 'run-completed' || event.type === 'run-failed') {
    for (const listener of job.listeners) listener.end();
    job.listeners.clear();
  }
}

function openRunJobEvents(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  job: RunJob,
): void {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
  });
  response.flushHeaders();
  const lastEventId = Number(request.headers['last-event-id'] ?? 0);
  for (const event of job.events) {
    if ((event.eventId ?? 0) <= lastEventId) continue;
    response.write(`id: ${event.eventId}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  if (job.status === 'completed' || job.status === 'failed') {
    response.end();
    return;
  }
  job.listeners.add(response);
  request.once('close', () => job.listeners.delete(response));
}

function manualLoginSessionName(project: string): string {
  const safeProject = project.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safeProject || 'auto-e2e'}-manual-login`;
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
  const fileNames = await discoverEditableTaskSpecs(directory);
  return Promise.all(fileNames.map(async (fileName) => {
    const raw = await readNamedTaskSpec(projectRoot, fileName);
    const parsed = validateTaskSpec(raw);
    return {
      fileName,
      reference: path.join(
        ACCEPTANCE_SPEC_DIRECTORY,
        fileName.endsWith('.spec.json') ? fileName : path.join(fileName, 'spec.json'),
      ),
      taskId: parsed.success ? parsed.spec?.taskId ?? null : null,
      title: parsed.success ? parsed.spec!.title : fileName,
      error: parsed.success
        ? null
        : parsed.errors.join('; '),
    };
  }));
}

async function discoverEditableTaskSpecs(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(directory: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === 'spec.json')) {
      result.push(path.relative(root, directory));
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name.endsWith('.spec.json')) {
        result.push(path.relative(root, absolute));
      }
    }
  }
  await walk(root);
  return result.sort((left, right) => left.localeCompare(right));
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
  const specRoot = path.join(projectRoot, ACCEPTANCE_SPEC_DIRECTORY);
  const segments = fileName.split('/');
  if (segments.length === 0 || segments.some((segment) =>
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment) || segment === '.' || segment === '..')) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `Spec Bundle 名称非法：${fileName}`,
    );
  }
  const leaf = segments.at(-1)!;
  if (isAcceptanceSpecFileName(leaf) && leaf !== 'spec.json') {
    return path.join(specRoot, ...segments);
  }
  return path.join(specRoot, ...segments, 'spec.json');
}

async function listBundleResources(
  projectRoot: string,
  fileName: string,
): Promise<Array<{ path: string; size: number }>> {
  const bundleDirectory = await resolveExistingBundleDirectory(projectRoot, fileName);
  const files: Array<{ path: string; size: number }> = [];
  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && absolute !== path.join(bundleDirectory, 'spec.json')) {
        files.push({
          path: path.relative(bundleDirectory, absolute).split(path.sep).join('/'),
          size: (await fs.stat(absolute)).size,
        });
      }
    }
  }
  await walk(bundleDirectory);
  return files;
}

async function writeBundleResource(
  projectRoot: string,
  fileName: string,
  resourcePath: string,
  content: Buffer,
): Promise<void> {
  if (content.length === 0) throw new AutoE2EError(ExitCode.Blocked, '资源文件不能为空');
  const bundleDirectory = await resolveExistingBundleDirectory(projectRoot, fileName);
  const target = await resolveWritableBundleResource(bundleDirectory, resourcePath);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, content, { mode: 0o600 });
  await fs.rename(temporary, target);
}

async function deleteBundleResource(
  projectRoot: string,
  fileName: string,
  resourcePath: string,
): Promise<void> {
  const bundleDirectory = await resolveExistingBundleDirectory(projectRoot, fileName);
  const target = await resolveWritableBundleResource(bundleDirectory, resourcePath);
  try {
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new AutoE2EError(ExitCode.Blocked, `Bundle 资源不是普通文件：${resourcePath}`);
    }
    await fs.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function resolveExistingBundleDirectory(projectRoot: string, fileName: string): Promise<string> {
  if (fileName.endsWith('.spec.json')) {
    throw new AutoE2EError(ExitCode.Blocked, '旧版 Spec 不支持 Bundle 资源');
  }
  const specFile = resolveNamedTaskSpec(projectRoot, fileName);
  try {
    const stat = await fs.stat(specFile);
    if (!stat.isFile()) throw new Error('not a file');
    return await fs.realpath(path.dirname(specFile));
  } catch {
    throw new AutoE2EError(ExitCode.Blocked, `Spec Bundle 不存在：${fileName}`);
  }
}

async function resolveWritableBundleResource(bundleDirectory: string, resourcePath: string): Promise<string> {
  const segments = resourcePath.split('/');
  if (segments.length < 2 || segments.some((segment) =>
    !segment || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\0'))) {
    throw new AutoE2EError(ExitCode.Blocked, `Bundle 资源路径非法：${resourcePath}`);
  }
  if (segments.at(-1) === 'spec.json') {
    throw new AutoE2EError(ExitCode.Blocked, '不能通过资源接口覆盖 spec.json');
  }
  let directory = bundleDirectory;
  for (const segment of segments.slice(0, -1)) {
    const next = path.join(directory, segment);
    try {
      const stat = await fs.lstat(next);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new AutoE2EError(ExitCode.Blocked, `Bundle 资源目录不安全：${resourcePath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await fs.mkdir(next, { mode: 0o700 });
    }
    directory = next;
  }
  const target = path.join(directory, segments.at(-1)!);
  try {
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new AutoE2EError(ExitCode.Blocked, `Bundle 资源目标不安全：${resourcePath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return target;
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

async function readBinaryBody(request: http.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > limit) {
        request.destroy(new Error(`请求体超过 ${Math.floor(limit / 1024 / 1024)} MB`));
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => resolve(Buffer.concat(chunks, size)));
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
        : extension === '.webp' ? 'image/webp'
        : 'application/octet-stream';
    send(response, 200, content, type);
  } catch {
    sendJson(response, 404, { ok: false, error: 'Artifact 不存在' });
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
