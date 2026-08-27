import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AutoE2EConfig } from '../config/config-schema.js';
import type { AcceptanceCriterionResult, AcceptanceRun } from '../domain/acceptance-run.js';
import { createRunId } from '../runtime/run-id.js';
import type { Logger } from '../runtime/logger.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { loadAcceptanceRequirement } from './requirement-loader.js';
import {
  BetterWrightCli,
  buildAcceptancePrompt,
  parseAcceptanceAnswer,
  preserveProof,
} from './betterwright-cli.js';
import { AcceptanceHistoryStore } from './history-store.js';

const execFileAsync = promisify(execFile);

export interface ExecuteAcceptanceOptions {
  projectRoot: string;
  config: AutoE2EConfig;
  spec?: string;
  requirement?: string;
  change?: string;
  url?: string;
  profile?: string;
  model?: string;
  session?: string;
  headed?: boolean;
  fresh?: boolean;
  betterwrightBinary?: string;
  logger?: Logger;
  now?: () => Date;
}

export async function executeAcceptance(
  options: ExecuteAcceptanceOptions,
): Promise<AcceptanceRun> {
  const now = options.now ?? (() => new Date());
  const startedDate = now();
  const startedAt = startedDate.toISOString();
  const runId = createRunId(startedDate);
  const requirement = await loadAcceptanceRequirement(options);
  const targetUrl = validateTargetUrl(options.url ?? options.config.project.baseUrl);
  const profile = options.profile ?? options.config.acceptance.profile;
  const model = options.model ?? options.config.acceptance.model;
  const session = options.session ?? createSessionName(options.config.project.name, runId);
  const artifactDirectory = path.resolve(
    options.projectRoot,
    options.config.report.artifactDirectory,
    runId,
  );
  const client = new BetterWrightCli({
    binary: options.betterwrightBinary,
    cwd: options.projectRoot,
    logger: options.logger,
  });
  const prompt = buildAcceptancePrompt({
    ...requirement,
    targetUrl,
    forbiddenActions: options.config.acceptance.forbiddenActions,
  });
  let envelope;
  try {
    envelope = await client.exec({
      prompt,
      model,
      profile,
      session,
      headed: options.headed ?? options.config.acceptance.headed,
      fresh: options.fresh,
    });
  } catch (error) {
    if (!(error instanceof AutoE2EError)) throw error;
    envelope = { ok: false, answer: '', steps: 0, reason: error.message, proof: null };
  }

  let summary: string;
  let criteria: AcceptanceCriterionResult[];
  let status: AcceptanceRun['status'];
  let error: string | null = null;
  if (envelope.ok) {
    try {
      const answer = parseAcceptanceAnswer(envelope.answer, requirement.criteria);
      summary = answer.summary;
      criteria = answer.criteria;
      status = deriveStatus(criteria);
    } catch (parseError) {
      if (!(parseError instanceof AutoE2EError)) throw parseError;
      error = parseError.message;
      summary = error;
      criteria = blockedCriteria(requirement.criteria, error);
      status = 'blocked';
    }
  } else {
    error = envelope.reason ?? (envelope.answer || 'BetterWright 未完成验收任务');
    summary = error;
    criteria = blockedCriteria(requirement.criteria, error);
    status = 'blocked';
  }

  const preserved = await preserveProof(envelope.proof, artifactDirectory);
  const storedProof = toStoredPath(options.projectRoot, preserved);
  criteria = await Promise.all(criteria.map(async (criterion) => {
    const criterionProof = criterion.proof
      ? await preserveProof(
          criterion.proof,
          artifactDirectory,
          `${criterion.id.toLowerCase()}-proof.png`,
        )
      : null;
    return {
      ...criterion,
      proof: toStoredPath(options.projectRoot, criterionProof) ?? storedProof,
    };
  }));
  const finishedAt = now().toISOString();
  const run: AcceptanceRun = {
    schemaVersion: 1,
    runId,
    project: options.config.project.name,
    source: requirement.source,
    commit: await readCommit(options.projectRoot),
    targetUrl,
    profile,
    model,
    session,
    status,
    startedAt,
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - startedDate.getTime()),
    summary,
    criteria,
    steps: envelope.steps,
    proof: storedProof,
    error,
  };

  const store = new AcceptanceHistoryStore(
    options.projectRoot,
    options.config.acceptance.databasePath,
  );
  await store.save(run);
  await writeRunSnapshot(options.projectRoot, options.config, run);
  return run;
}

function blockedCriteria(
  criteria: Array<{ id: string; description: string }>,
  reason: string,
): AcceptanceCriterionResult[] {
  return criteria.map((criterion) => ({
    ...criterion,
    status: 'blocked',
    actual: reason,
    proof: null,
  }));
}

function validateTargetUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('仅支持 http/https');
    return url.toString();
  } catch (error) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `目标 URL 无效：${raw}（${error instanceof Error ? error.message : String(error)}）`,
    );
  }
}

function deriveStatus(criteria: AcceptanceCriterionResult[]): AcceptanceRun['status'] {
  if (criteria.some((criterion) => criterion.status === 'failed')) return 'failed';
  if (criteria.some((criterion) => criterion.status === 'blocked')) return 'blocked';
  return 'passed';
}

function createSessionName(project: string, runId: string): string {
  const safeProject = project.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safeProject || 'auto-e2e'}-${runId.slice(0, 15)}`;
}

async function readCommit(projectRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function toStoredPath(projectRoot: string, value: string | null): string | null {
  if (!value) return null;
  if (!path.isAbsolute(value)) return value;
  const relative = path.relative(projectRoot, value);
  return relative.startsWith('..') ? value : relative;
}

async function writeRunSnapshot(
  projectRoot: string,
  config: AutoE2EConfig,
  run: AcceptanceRun,
): Promise<void> {
  const reportRoot = path.resolve(projectRoot, config.report.outputDirectory, 'acceptance');
  const runDirectory = path.join(reportRoot, 'runs', run.runId);
  await fs.mkdir(runDirectory, { recursive: true });
  const content = `${JSON.stringify(run, null, 2)}\n`;
  await fs.writeFile(path.join(runDirectory, 'result.json'), content, 'utf8');
  await fs.mkdir(path.join(reportRoot, 'latest'), { recursive: true });
  await fs.writeFile(path.join(reportRoot, 'latest', 'result.json'), content, 'utf8');
}
