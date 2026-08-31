import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AutoE2EConfig } from '../config/config-schema.js';
import type {
  AcceptanceCaseRun,
  AcceptanceCriterionResult,
  AcceptanceRun,
  AcceptanceSuiteRun,
  SingleAcceptanceRun,
} from '../domain/acceptance-run.js';
import { createRunId } from '../runtime/run-id.js';
import type { Logger } from '../runtime/logger.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { loadAcceptanceRequirements, type LoadedRequirement } from './requirement-loader.js';
import {
  BetterWrightCli,
  buildAcceptancePrompt,
  parseAcceptanceAnswer,
  preserveProof,
} from './betterwright-cli.js';
import { AcceptanceHistoryStore } from './history-store.js';
import { validateFileInputs, validateTargetUrl } from './preflight.js';

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
  const requirementSet = await loadAcceptanceRequirements(options);
  const targetUrl = validateTargetUrl(options.url ?? options.config.project.baseUrl);
  const profile = options.profile ?? options.config.acceptance.profile;
  const model = options.model ?? options.config.acceptance.model;
  const baseSession = options.session ?? createSessionName(options.config.project.name, runId);
  const artifactRoot = path.resolve(
    options.projectRoot,
    options.config.report.artifactDirectory,
    runId,
  );
  const client = new BetterWrightCli({
    binary: options.betterwrightBinary,
    cwd: options.projectRoot,
    logger: options.logger,
  });
  const cases: AcceptanceCaseRun[] = [];
  for (const [index, requirement] of requirementSet.requirements.entries()) {
    const session = requirementSet.suite
      ? `${baseSession}-${safeCaseId(requirement.caseId, index)}`
      : baseSession;
    cases.push(await executeCase({
      requirement,
      targetUrl,
      profile,
      model,
      session,
      artifactDirectory: requirementSet.suite
        ? path.join(artifactRoot, safeCaseId(requirement.caseId, index))
        : artifactRoot,
      projectRoot: options.projectRoot,
      forbiddenActions: options.config.acceptance.forbiddenActions,
      headed: options.headed ?? options.config.acceptance.headed,
      fresh: options.fresh,
      client,
      now,
      stagingId: `${runId}-${safeCaseId(requirement.caseId, index)}`,
    }));
  }

  const finishedAt = now().toISOString();
  const commit = await readCommit(options.projectRoot);
  let run: AcceptanceRun;
  if (!requirementSet.suite) {
    const result = cases[0]!;
    run = {
      schemaVersion: 1,
      runId,
      project: options.config.project.name,
      source: result.source,
      commit,
      targetUrl,
      profile,
      model,
      session: result.session,
      status: result.status,
      startedAt,
      finishedAt,
      durationMs: Math.max(0, new Date(finishedAt).getTime() - startedDate.getTime()),
      summary: result.summary,
      criteria: result.criteria,
      steps: result.steps,
      proof: result.proof,
      error: result.error,
    } satisfies SingleAcceptanceRun;
  } else {
    const status = deriveSuiteStatus(cases);
    const passed = cases.filter((item) => item.status === 'passed').length;
    const errors = cases.flatMap((item) => item.error ? [`${item.caseId}: ${item.error}`] : []);
    run = {
      schemaVersion: 2,
      runId,
      project: options.config.project.name,
      source: {
        type: 'task-spec',
        reference: requirementSet.reference,
        title: requirementSet.title,
        content: requirementSet.requirements
          .map((item) => `${item.caseId} · ${item.source.title}\n${item.source.content}`)
          .join('\n\n'),
      },
      commit,
      targetUrl,
      profile,
      model,
      status,
      startedAt,
      finishedAt,
      durationMs: Math.max(0, new Date(finishedAt).getTime() - startedDate.getTime()),
      summary: `${passed}/${cases.length} 个用例通过`,
      cases,
      steps: cases.reduce((total, item) => total + item.steps, 0),
      proof: null,
      error: errors.length ? errors.join('\n') : null,
    } satisfies AcceptanceSuiteRun;
  }

  const store = new AcceptanceHistoryStore(
    options.projectRoot,
    options.config.acceptance.databasePath,
  );
  await store.save(run);
  await writeRunSnapshot(options.projectRoot, options.config, run);
  return run;
}

async function executeCase(input: {
  requirement: LoadedRequirement;
  targetUrl: string;
  profile: string;
  model: string;
  session: string;
  artifactDirectory: string;
  projectRoot: string;
  forbiddenActions: string[];
  headed: boolean;
  fresh?: boolean;
  client: BetterWrightCli;
  now: () => Date;
  stagingId: string;
}): Promise<AcceptanceCaseRun> {
  const startedDate = input.now();
  const staged = await stageFileInputs(
    input.projectRoot,
    input.requirement.inputs,
    input.stagingId,
  );
  const prompt = buildAcceptancePrompt({
    ...input.requirement,
    targetUrl: input.targetUrl,
    forbiddenActions: input.forbiddenActions,
    inputs: staged.inputs,
  });
  let envelope;
  try {
    envelope = await input.client.exec({
      prompt,
      model: input.model,
      profile: input.profile,
      session: input.session,
      headed: input.headed,
      fresh: input.fresh,
    });
  } catch (error) {
    if (!(error instanceof AutoE2EError)) throw error;
    envelope = { ok: false, answer: '', steps: 0, reason: error.message, proof: null };
  } finally {
    await fs.rm(staged.directory, { recursive: true, force: true });
  }

  let summary: string;
  let criteria: AcceptanceCriterionResult[];
  let status: AcceptanceRun['status'];
  let error: string | null = null;
  if (envelope.ok) {
    try {
      const answer = parseAcceptanceAnswer(envelope.answer, input.requirement.criteria);
      summary = answer.summary;
      criteria = answer.criteria;
      status = deriveStatus(criteria);
    } catch (parseError) {
      if (!(parseError instanceof AutoE2EError)) throw parseError;
      error = parseError.message;
      summary = error;
      criteria = blockedCriteria(input.requirement.criteria, error);
      status = 'blocked';
    }
  } else {
    error = envelope.reason ?? (envelope.answer || 'BetterWright 未完成验收任务');
    summary = error;
    criteria = blockedCriteria(input.requirement.criteria, error);
    status = 'blocked';
  }

  const preserved = await preserveProof(envelope.proof, input.artifactDirectory);
  const storedProof = toStoredPath(input.projectRoot, preserved);
  criteria = await Promise.all(criteria.map(async (criterion) => {
    const criterionProof = criterion.proof
      ? await preserveProof(
          criterion.proof,
          input.artifactDirectory,
          `${criterion.id.toLowerCase()}-proof.png`,
        )
      : null;
    return {
      ...criterion,
      proof: toStoredPath(input.projectRoot, criterionProof) ?? storedProof,
    };
  }));
  const finishedAt = input.now().toISOString();
  return {
    caseId: input.requirement.caseId,
    source: input.requirement.source,
    session: input.session,
    status,
    startedAt: startedDate.toISOString(),
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - startedDate.getTime()),
    summary,
    criteria,
    steps: envelope.steps,
    proof: storedProof,
    error,
  };
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

function deriveStatus(criteria: AcceptanceCriterionResult[]): AcceptanceRun['status'] {
  if (criteria.some((criterion) => criterion.status === 'failed')) return 'failed';
  if (criteria.some((criterion) => criterion.status === 'blocked')) return 'blocked';
  return 'passed';
}

function deriveSuiteStatus(cases: AcceptanceCaseRun[]): AcceptanceRun['status'] {
  if (cases.some((item) => item.status === 'failed')) return 'failed';
  if (cases.some((item) => item.status === 'blocked')) return 'blocked';
  if (cases.some((item) => item.status === 'error')) return 'error';
  return 'passed';
}

function safeCaseId(caseId: string, index: number): string {
  const safe = caseId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${String(index + 1).padStart(2, '0')}-${safe || 'case'}`;
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

async function stageFileInputs(
  projectRoot: string,
  inputs: LoadedRequirement['inputs'],
  stagingId: string,
): Promise<{
  directory: string;
  inputs: Array<{ name: string; path: string; description?: string }>;
}> {
  const betterWrightHome = path.resolve(
    process.env.BETTERWRIGHT_HOME?.trim() || path.join(os.homedir(), '.betterwright'),
  );
  const directory = path.join(betterWrightHome, 'artifacts', 'auto-e2e-inputs', stagingId);
  if (inputs.length === 0) return { directory, inputs: [] };

  const validated = await validateFileInputs(projectRoot, inputs);

  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    const stagedInputs = [];
    for (const [index, { item, source }] of validated.entries()) {
      const target = path.join(
        directory,
        `${String(index + 1).padStart(2, '0')}-${path.basename(source)}`,
      );
      await fs.copyFile(source, target);
      stagedInputs.push({
        name: item.name,
        path: target,
        ...(item.description ? { description: item.description } : {}),
      });
    }
    return { directory, inputs: stagedInputs };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}
