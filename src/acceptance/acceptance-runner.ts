import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AutoE2EConfig } from '../config/config-schema.js';
import type {
  AcceptanceCaseRun,
  AcceptanceCriterionResult,
  AcceptanceResultAssertion,
  AcceptanceRun,
  AcceptanceSuiteRun,
  AcceptanceWorkflowStepResult,
  SingleAcceptanceRun,
} from '../domain/acceptance-run.js';
import type { TaskResource, TaskResult } from '../domain/task-spec.js';
import { createRunId } from '../runtime/run-id.js';
import type { Logger } from '../runtime/logger.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { loadAcceptanceRequirements, type LoadedRequirement } from './requirement-loader.js';
import {
  BetterWrightCli,
  buildAcceptancePrompt,
  parseBundleAcceptanceAnswer,
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
  specs?: string[];
  url?: string;
  profile?: string;
  model?: string;
  session?: string;
  headed?: boolean;
  fresh?: boolean;
  concurrency?: number;
  betterwrightBinary?: string;
  logger?: Logger;
  now?: () => Date;
  lifecycle?: AcceptanceRunLifecycle;
  signal?: AbortSignal;
}

export interface AcceptanceCaseLifecycleContext {
  caseId: string;
  title: string;
  index: number;
  total: number;
  profile: string;
  session: string;
  concurrency: number;
}

export interface AcceptanceRunLifecycle {
  onCaseStarting?(context: AcceptanceCaseLifecycleContext): void | Promise<void>;
  onCaseCompleted?(
    context: AcceptanceCaseLifecycleContext,
    result: AcceptanceCaseRun,
  ): void | Promise<void>;
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
  const concurrency = resolveConcurrency(
    options.concurrency ?? options.config.acceptance.concurrency,
  );
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
  const cases = await mapWithConcurrency(
    requirementSet.requirements,
    concurrency,
    async (requirement, index) => {
      throwIfCancelled(options.signal);
      const session = requirementSet.suite
        ? `${baseSession}-${safeCaseId(requirement.caseId, index)}`
        : baseSession;
      const lifecycleContext: AcceptanceCaseLifecycleContext = {
        caseId: requirement.caseId,
        title: requirement.source.title,
        index,
        total: requirementSet.requirements.length,
        profile,
        session,
        concurrency,
      };
      await options.lifecycle?.onCaseStarting?.(lifecycleContext);
      const caseRun = await executeCase({
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
        signal: options.signal,
      });
      throwIfCancelled(options.signal);
      await options.lifecycle?.onCaseCompleted?.(lifecycleContext, caseRun);
      return caseRun;
    },
  );

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
      ...(result.specDigest ? { specDigest: result.specDigest } : {}),
      ...(result.workflowSteps ? { workflowSteps: result.workflowSteps } : {}),
      ...(result.resultAssertions ? { resultAssertions: result.resultAssertions } : {}),
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

function resolveConcurrency(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 32) {
    throw new AutoE2EError(ExitCode.Blocked, '并发数必须是 1 到 32 之间的整数');
  }
  return value;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  execute: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  let hasError = false;
  let firstError: unknown;
  const worker = async (): Promise<void> => {
    while (!hasError) {
      const index = nextIndex++;
      if (index >= values.length) return;
      try {
        results[index] = await execute(values[index]!, index);
      } catch (error) {
        hasError = true;
        firstError = error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  if (hasError) throw firstError;
  return results;
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
  signal?: AbortSignal;
}): Promise<AcceptanceCaseRun> {
  const startedDate = input.now();
  const staged = input.requirement.resources.length > 0
    ? await stageBundleResources(
        input.requirement.fileBaseDirectory,
        input.requirement.resources,
        input.stagingId,
      )
    : await stageFileInputs(
        input.requirement.fileBaseDirectory,
        input.requirement.inputs,
        input.stagingId,
      );
  const prompt = buildAcceptancePrompt({
    ...input.requirement,
    targetUrl: input.targetUrl,
    forbiddenActions: input.forbiddenActions,
    inputs: staged.inputs,
    resources: staged.resources,
    workflowSteps: input.requirement.steps,
    results: input.requirement.results,
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
      signal: input.signal,
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
  let workflowSteps: AcceptanceWorkflowStepResult[] | undefined;
  let resultAssertions: AcceptanceResultAssertion[] | undefined;
  if (envelope.ok) {
    try {
      if (input.requirement.steps.length > 0) {
        const answer = parseBundleAcceptanceAnswer(
          envelope.answer,
          input.requirement.steps,
          input.requirement.results,
        );
        summary = answer.summary;
        workflowSteps = answer.steps.map((step, index) => ({
          ...step,
          instruction: input.requirement.steps[index]!.instruction,
          expected: input.requirement.steps[index]!.expected,
        }));
        resultAssertions = answer.results.map((result, index) =>
          evaluateResult(input.requirement.results[index]!, result),
        );
        criteria = bundleCriteria(input.requirement.criteria, workflowSteps, resultAssertions);
      } else {
        const answer = parseAcceptanceAnswer(envelope.answer, input.requirement.criteria);
        summary = answer.summary;
        criteria = answer.criteria;
      }
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

  const proofSourceRoots = [
    input.artifactDirectory,
    path.join(resolveBetterWrightHome(), 'artifacts'),
  ];
  const preserved = await preserveProof(
    envelope.proof,
    input.artifactDirectory,
    'proof.png',
    proofSourceRoots,
    input.projectRoot,
  );
  const storedProof = toStoredPath(input.projectRoot, preserved);
  criteria = await Promise.all(criteria.map(async (criterion) => {
    const criterionProof = criterion.proof
      ? await preserveProof(
          criterion.proof,
          input.artifactDirectory,
          `${criterion.id.toLowerCase()}-proof.png`,
          proofSourceRoots,
          input.projectRoot,
        )
      : null;
    return {
      ...criterion,
      proof: toStoredPath(input.projectRoot, criterionProof) ?? storedProof,
    };
  }));
  if (workflowSteps) {
    workflowSteps = await Promise.all(workflowSteps.map(async (step) => ({
      ...step,
      proof: toStoredPath(input.projectRoot, step.proof
        ? await preserveProof(
            step.proof,
            input.artifactDirectory,
            `${step.id.toLowerCase()}-proof.png`,
            proofSourceRoots,
            input.projectRoot,
          )
        : null),
    })));
  }
  if (resultAssertions) {
    resultAssertions = await Promise.all(resultAssertions.map(async (result) => ({
      ...result,
      proof: toStoredPath(input.projectRoot, result.proof
        ? await preserveProof(
            result.proof,
            input.artifactDirectory,
            `${result.id.toLowerCase()}-proof.png`,
            proofSourceRoots,
            input.projectRoot,
          )
        : null),
    })));
  }
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
    ...(input.requirement.specDigest ? { specDigest: input.requirement.specDigest } : {}),
    ...(workflowSteps ? { workflowSteps } : {}),
    ...(resultAssertions ? { resultAssertions } : {}),
  };
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AutoE2EError(ExitCode.Blocked, '验收运行已取消');
  }
}

function evaluateResult(
  spec: TaskResult,
  observation: {
    status: 'observed' | 'matched' | 'mismatched' | 'blocked';
    actual: unknown;
    proof: string | null;
    error: string | null;
  },
): AcceptanceResultAssertion {
  const base = {
    id: spec.id,
    name: spec.name,
    expected: spec.expected,
    actual: observation.actual as AcceptanceResultAssertion['actual'],
    match: spec.match,
    proof: observation.proof,
    error: observation.error,
  };
  if (observation.status === 'blocked') return { ...base, status: 'blocked' };
  if (spec.match === 'visual' || spec.match === 'table' || spec.match === 'file') {
    if (observation.status === 'matched') return { ...base, status: 'passed' };
    if (observation.status === 'mismatched') return { ...base, status: 'failed' };
    return { ...base, status: 'blocked', error: '该结果需要执行器完成比较，但只返回了 observed' };
  }

  if (spec.match === 'equals') {
    const actual = typeof observation.actual === 'string' && spec.options?.trim
      ? observation.actual.trim()
      : observation.actual;
    const expected = typeof spec.expected === 'string' && spec.options?.trim
      ? spec.expected.trim()
      : spec.expected;
    return { ...base, status: actual === expected ? 'passed' : 'failed' };
  }
  if (spec.match === 'contains') {
    if (typeof observation.actual !== 'string' || typeof spec.expected !== 'string') {
      return { ...base, status: 'failed', error: 'contains 的页面实际值必须是字符串' };
    }
    return {
      ...base,
      status: observation.actual.includes(spec.expected) ? 'passed' : 'failed',
    };
  }
  if (typeof observation.actual !== 'number' || typeof spec.expected !== 'number') {
    return { ...base, status: 'failed', error: 'numeric 的页面实际值必须是数字' };
  }
  const difference = Math.abs(observation.actual - spec.expected);
  return {
    ...base,
    status: difference <= (spec.options?.numericTolerance ?? 0) ? 'passed' : 'failed',
    difference,
  };
}

function bundleCriteria(
  expected: Array<{ id: string; description: string }>,
  steps: AcceptanceWorkflowStepResult[],
  results: AcceptanceResultAssertion[],
): AcceptanceCriterionResult[] {
  return [
    ...steps.map((step, index) => ({
      id: expected[index]!.id,
      description: expected[index]!.description,
      status: step.status === 'skipped' ? 'blocked' as const : step.status,
      actual: step.actual,
      proof: step.proof,
    })),
    ...results.map((result, index) => ({
      id: expected[steps.length + index]!.id,
      description: expected[steps.length + index]!.description,
      status: result.status,
      actual: typeof result.actual === 'string' ? result.actual : JSON.stringify(result.actual),
      proof: result.proof,
    })),
  ];
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
  resources: Array<{ id: string; name?: string; role: 'input' | 'expected' | 'reference'; path: string }>;
}> {
  const betterWrightHome = resolveBetterWrightHome();
  const directory = path.join(betterWrightHome, 'artifacts', 'auto-e2e-inputs', stagingId);
  if (inputs.length === 0) return { directory, inputs: [], resources: [] };

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
    return { directory, inputs: stagedInputs, resources: [] };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function stageBundleResources(
  bundleRoot: string,
  resources: TaskResource[],
  stagingId: string,
): Promise<{
  directory: string;
  inputs: Array<{ name: string; path: string; description?: string }>;
  resources: Array<{ id: string; name?: string; role: 'input' | 'expected' | 'reference'; path: string }>;
}> {
  const betterWrightHome = resolveBetterWrightHome();
  const directory = path.join(betterWrightHome, 'artifacts', 'auto-e2e-inputs', stagingId);
  const validated = await validateFileInputs(
    bundleRoot,
    resources.map((resource) => ({ name: resource.name ?? resource.id, path: resource.path })),
  );
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    const stagedResources = [];
    for (const [index, resource] of resources.entries()) {
      const source = validated[index]!.source;
      const target = path.join(
        directory,
        `${String(index + 1).padStart(2, '0')}-${path.basename(source)}`,
      );
      await fs.copyFile(source, target);
      stagedResources.push({
        id: resource.id,
        ...(resource.name ? { name: resource.name } : {}),
        role: resource.role,
        path: target,
      });
    }
    return { directory, inputs: [], resources: stagedResources };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

function resolveBetterWrightHome(): string {
  return path.resolve(
    process.env.BETTERWRIGHT_HOME?.trim() || path.join(os.homedir(), '.betterwright'),
  );
}
