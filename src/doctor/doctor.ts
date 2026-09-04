import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { BetterWrightCli, type BetterWrightDoctorReport } from '../acceptance/betterwright-cli.js';
import { validateFileInputs, validateTargetUrl } from '../acceptance/preflight.js';
import { loadAcceptanceRequirements, type LoadedRequirementSet } from '../acceptance/requirement-loader.js';
import { CONFIG_FILENAME, loadConfig, resolveConfigFile } from '../config/config-loader.js';
import type { AutoE2EConfig } from '../config/config-schema.js';
import { ACCEPTANCE_SPEC_DIRECTORY, isAcceptanceSpecFileName } from '../domain/task-spec.js';
import type { Logger } from '../runtime/logger.js';

export type DoctorStatus = 'pass' | 'warn' | 'fail' | 'skip';
export type DoctorScope = 'all' | 'tool' | 'project';

export interface DoctorCheck {
  id: string;
  label: string;
  status: DoctorStatus;
  detail: string;
  fix?: string;
}

export interface DoctorGroup {
  status: DoctorStatus;
  checks: DoctorCheck[];
}

export interface DoctorReport {
  ok: boolean;
  scope: DoctorScope;
  summary: Record<DoctorStatus, number>;
  groups: Partial<Record<'tool' | 'project', DoctorGroup>>;
}

export interface RunDoctorOptions {
  projectRoot: string;
  configPath?: string;
  scope?: DoctorScope;
  betterwrightBinary?: string;
  logger?: Logger;
  fetch?: typeof fetch;
  targetTimeoutMs?: number;
}

export async function runDoctor(options: RunDoctorOptions): Promise<DoctorReport> {
  const scope = options.scope ?? 'all';
  const groups: DoctorReport['groups'] = {};
  if (scope !== 'project') groups.tool = group(await runToolChecks(options));
  if (scope !== 'tool') groups.project = group(await runProjectChecks(options));
  const checks = Object.values(groups).flatMap((item) => item?.checks ?? []);
  const summary = countStatuses(checks);
  return { ok: summary.fail === 0, scope, summary, groups };
}

async function runToolChecks(options: RunDoctorOptions): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [checkNode(), checkSqlite()];
  try {
    const report = await new BetterWrightCli({
      binary: options.betterwrightBinary,
      cwd: options.projectRoot,
      logger: options.logger,
    }).doctor();
    checks.push(...mapBetterWrightChecks(report));
  } catch (error) {
    checks.push(makeCheck(
      'tool.betterwright',
      'BetterWright',
      'fail',
      errorMessage(error),
      '重新安装 BetterWright，然后执行 `betterwright setup` 和 `betterwright doctor`',
    ));
  }
  return checks;
}

function checkNode(): DoctorCheck {
  const current = process.versions.node;
  const supported = compareVersion(current, '22.18.0') >= 0;
  return makeCheck(
    'tool.node',
    'Node.js',
    supported ? 'pass' : 'fail',
    `v${current}（要求 >=22.18.0）`,
    supported ? undefined : '安装 Node.js 22.18.0 或更高版本',
  );
}

function checkSqlite(): DoctorCheck {
  try {
    const db = openDatabase(':memory:');
    try {
      db.exec('CREATE TABLE doctor_probe(value INTEGER); BEGIN; INSERT INTO doctor_probe VALUES (1); ROLLBACK;');
      const row = db.prepare('SELECT COUNT(*) AS count FROM doctor_probe').get() as { count: number };
      if (row.count !== 0) throw new Error('事务回滚验证失败');
    } finally {
      db.close();
    }
    return makeCheck('tool.sqlite', 'SQLite', 'pass', 'node:sqlite 内存库可用');
  } catch (error) {
    return makeCheck('tool.sqlite', 'SQLite', 'fail', errorMessage(error), '使用包含 node:sqlite 的受支持 Node.js 版本');
  }
}

function mapBetterWrightChecks(report: BetterWrightDoctorReport): DoctorCheck[] {
  const browser = report.browser ?? 'unknown';
  const version = report.playwright_version ? `，Playwright ${report.playwright_version}` : '';
  const checks = [makeCheck(
    'tool.betterwright',
    'BetterWright',
    report.ready ? 'pass' : 'fail',
    `browser=${browser}${version}${report.browser_selection_reason ? `，reason=${report.browser_selection_reason}` : ''}`,
    report.ready ? undefined : '执行 `betterwright setup`，然后重新运行 doctor',
  )];
  for (const item of report.checks) {
    let status: DoctorStatus = item.status === 'ok' ? 'pass' : item.status;
    const noModelBackend = item.group === 'Built-in agent' &&
      item.label === 'Model backends' &&
      item.status !== 'ok';
    if (noModelBackend) status = 'fail';
    checks.push(makeCheck(
      `tool.betterwright.${slug(item.group)}.${slug(item.label)}`,
      `${item.group} / ${item.label}`,
      status,
      item.detail,
      item.fix ?? undefined,
    ));
  }
  return checks;
}

async function runProjectChecks(options: RunDoctorOptions): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  try {
    const stat = await fs.stat(options.projectRoot);
    if (!stat.isDirectory()) throw new Error('路径不是目录');
    await fs.access(options.projectRoot, fs.constants.R_OK);
    checks.push(makeCheck('project.root', '项目根目录', 'pass', options.projectRoot));
  } catch (error) {
    checks.push(makeCheck('project.root', '项目根目录', 'fail', errorMessage(error), '检查 --project-root 指向的目录'));
    checks.push(makeCheck('project.config', '项目配置', 'skip', '项目根目录不可用'));
    checks.push(...skippedProjectChecks('项目根目录不可用'));
    return checks;
  }

  let config: AutoE2EConfig;
  let configPath = options.configPath ?? CONFIG_FILENAME;
  try {
    configPath = await resolveConfigFile(options);
    const configExists = await exists(configPath);
    config = await loadConfig(options);
    checks.push(makeCheck(
      'project.config',
      '项目配置',
      configExists ? 'pass' : 'warn',
      configExists ? `${configPath} 校验通过` : `未找到 ${CONFIG_FILENAME}，已使用默认配置`,
      configExists ? undefined : `在项目根目录创建 ${CONFIG_FILENAME}`,
    ));
  } catch (error) {
    checks.push(makeCheck('project.config', '项目配置', 'fail', errorMessage(error), `修复 ${configPath} 后重试`));
    checks.push(...skippedProjectChecks('项目配置无效'));
    return checks;
  }

  let targetUrl: string | undefined;
  try {
    targetUrl = validateTargetUrl(config.project.baseUrl);
    checks.push(makeCheck('project.url', '目标 URL', 'pass', safeUrl(targetUrl)));
  } catch (error) {
    checks.push(makeCheck('project.url', '目标 URL', 'fail', errorMessage(error), '将 project.baseUrl 设为有效的 HTTP(S) URL'));
  }

  checks.push(...await checkStorage(options.projectRoot, config));
  const specification = await checkSpecifications(options.projectRoot);
  checks.push(specification.specs);
  checks.push(specification.inputs);
  checks.push(targetUrl
    ? await checkTarget(targetUrl, options.fetch ?? fetch, options.targetTimeoutMs ?? 5_000)
    : makeCheck('project.target', '目标应用', 'skip', '目标 URL 无效'));
  return checks;
}

async function checkStorage(projectRoot: string, config: AutoE2EConfig): Promise<DoctorCheck[]> {
  const definitions = [
    { id: 'project.storage.database', label: '历史数据库', value: config.acceptance.databasePath, database: true },
    { id: 'project.storage.report', label: '报告目录', value: config.report.outputDirectory, database: false },
    { id: 'project.storage.artifact', label: 'Artifact 目录', value: config.report.artifactDirectory, database: false },
  ];
  return Promise.all(definitions.map(async (definition) => {
    const target = path.resolve(projectRoot, definition.value);
    try {
      await probeStorageTarget(target, definition.database);
      return makeCheck(definition.id, definition.label, 'pass', `${definition.value} 可用`);
    } catch (error) {
      return makeCheck(definition.id, definition.label, 'fail', errorMessage(error), '检查路径类型与父目录写权限');
    }
  }));
}

async function probeStorageTarget(target: string, database: boolean): Promise<void> {
  try {
    const stat = await fs.stat(target);
    if (database && !stat.isFile()) throw new Error(`${target} 不是普通文件`);
    if (!database && !stat.isDirectory()) throw new Error(`${target} 不是目录`);
    await fs.access(target, fs.constants.R_OK | fs.constants.W_OK);
    if (database) {
      const db = openDatabase(target, { readOnly: true });
      try { db.prepare('PRAGMA quick_check').get(); } finally { db.close(); }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const ancestor = await nearestExistingDirectory(database ? path.dirname(target) : target);
  const temporary = await fs.mkdtemp(path.join(ancestor, '.auto-e2e-doctor-'));
  try {
    if (database) {
      const db = openDatabase(path.join(temporary, 'probe.sqlite'));
      try {
        db.exec('CREATE TABLE probe(value INTEGER); BEGIN; INSERT INTO probe VALUES (1); COMMIT;');
      } finally {
        db.close();
      }
    } else {
      await fs.writeFile(path.join(temporary, 'probe'), 'ok', 'utf8');
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

async function nearestExistingDirectory(start: string): Promise<string> {
  let current = start;
  while (true) {
    try {
      const stat = await fs.stat(current);
      if (!stat.isDirectory()) throw new Error(`${current} 不是目录`);
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

async function checkSpecifications(projectRoot: string): Promise<{ specs: DoctorCheck; inputs: DoctorCheck }> {
  let loaded: LoadedRequirementSet;
  try {
    loaded = await loadAcceptanceRequirements({ projectRoot });
  } catch (error) {
    if (errorMessage(error).includes('未找到验收用例')) {
      return {
        specs: makeCheck('project.specs', '验收规格', 'warn', `未找到 ${ACCEPTANCE_SPEC_DIRECTORY}/**/spec.json`, '创建至少一个 Spec Bundle 后即可执行默认 run'),
        inputs: makeCheck('project.inputs', 'Bundle 文件', 'skip', '没有可检查的验收规格'),
      };
    }
    return {
      specs: makeCheck('project.specs', '验收规格', 'fail', errorMessage(error), '修复规格 JSON、Schema 或重复 taskId'),
      inputs: makeCheck('project.inputs', 'Bundle 文件', 'skip', '验收规格无效'),
    };
  }
  try {
    for (const requirement of loaded.requirements) {
      await validateFileInputs(requirement.fileBaseDirectory, requirement.inputs);
    }
    const fileCount = loaded.requirements.reduce(
      (total, requirement) => total + requirement.inputs.length + requirement.resources.length,
      0,
    );
    return {
      specs: makeCheck('project.specs', '验收规格', 'pass', `${loaded.requirements.length} 个用例校验通过`),
      inputs: makeCheck('project.inputs', 'Bundle 文件', 'pass', fileCount ? `${fileCount} 个文件可用` : '未配置文件'),
    };
  } catch (error) {
    return {
      specs: makeCheck('project.specs', '验收规格', 'pass', `${loaded.requirements.length} 个用例校验通过`),
      inputs: makeCheck('project.inputs', 'Bundle 文件', 'fail', errorMessage(error), '修复文件路径，并确保文件位于用例目录内且可读'),
    };
  }
}

async function checkTarget(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<DoctorCheck> {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    const detail = `${safeUrl(response.url || url)} 返回 HTTP ${response.status}`;
    if (response.status >= 500) {
      return makeCheck('project.target', '目标应用', 'fail', detail, '修复目标应用的服务端错误');
    }
    if (response.status >= 400) {
      return makeCheck('project.target', '目标应用', 'warn', detail, '确认该状态是否为预期的登录或权限页面');
    }
    return makeCheck('project.target', '目标应用', 'pass', detail);
  } catch (error) {
    return makeCheck('project.target', '目标应用', 'fail', errorMessage(error), '启动被测应用并检查 DNS、TLS、网络和 project.baseUrl');
  }
}

function skippedProjectChecks(reason: string): DoctorCheck[] {
  return [
    makeCheck('project.url', '目标 URL', 'skip', reason),
    makeCheck('project.storage.database', '历史数据库', 'skip', reason),
    makeCheck('project.storage.report', '报告目录', 'skip', reason),
    makeCheck('project.storage.artifact', 'Artifact 目录', 'skip', reason),
    makeCheck('project.specs', '验收规格', 'skip', reason),
    makeCheck('project.inputs', '输入文件', 'skip', reason),
    makeCheck('project.target', '目标应用', 'skip', reason),
  ];
}

function group(checks: DoctorCheck[]): DoctorGroup {
  const statuses = checks.map((item) => item.status);
  const status = statuses.includes('fail') ? 'fail'
    : statuses.includes('warn') ? 'warn'
      : statuses.every((item) => item === 'skip') ? 'skip'
        : 'pass';
  return { status, checks };
}

function countStatuses(checks: DoctorCheck[]): Record<DoctorStatus, number> {
  const result: Record<DoctorStatus, number> = { pass: 0, warn: 0, fail: 0, skip: 0 };
  for (const item of checks) result[item.status] += 1;
  return result;
}

function makeCheck(
  id: string,
  label: string,
  status: DoctorStatus,
  detail: string,
  fix?: string,
): DoctorCheck {
  return {
    id,
    label,
    status,
    detail: redact(detail),
    ...(fix ? { fix: redact(fix) } : {}),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redact(value: string): string {
  return value
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/gi, '$1***:***@')
    .replace(/\b(api[_-]?key|token|password|cookie|authorization)\b\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]');
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = '***';
      url.password = '***';
    }
    return url.toString();
  } catch {
    return redact(value);
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'check';
}

function compareVersion(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

async function exists(file: string): Promise<boolean> {
  try { await fs.access(file); return true; } catch { return false; }
}

function openDatabase(
  location: string,
  options?: { readOnly?: boolean },
): DatabaseSyncType {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  return options ? new DatabaseSync(location, options) : new DatabaseSync(location);
}
