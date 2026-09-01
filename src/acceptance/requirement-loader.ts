import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import {
  ACCEPTANCE_SPEC_DIRECTORY,
  ACCEPTANCE_SPEC_SUFFIX,
  ACCEPTANCE_BUNDLE_FILENAME,
  isBundleTaskSpec,
  isAcceptanceSpecFileName,
  validateTaskSpec,
  type TaskResource,
  type TaskResult,
  type TaskStep,
  type TaskExpectedOutput,
  type TaskFileInput,
} from '../domain/task-spec.js';
import type {
  AcceptanceCriterionInput,
  AcceptanceSource,
} from '../domain/acceptance-run.js';

export interface LoadedRequirement {
  caseId: string;
  source: AcceptanceSource;
  criteria: AcceptanceCriterionInput[];
  inputs: TaskFileInput[];
  outputs: TaskExpectedOutput[];
  resources: TaskResource[];
  steps: TaskStep[];
  results: TaskResult[];
  fileBaseDirectory: string;
  specDigest: string | null;
}

export interface LoadedRequirementSet {
  suite: boolean;
  title: string;
  reference: string;
  requirements: LoadedRequirement[];
}

export async function loadAcceptanceRequirement(input: {
  projectRoot: string;
  spec?: string;
}): Promise<LoadedRequirement> {
  const loaded = await loadAcceptanceRequirements(input);
  if (loaded.requirements.length !== 1) {
    throw new AutoE2EError(ExitCode.Blocked, '该规格来源包含多个用例，请使用多用例运行入口');
  }
  return loaded.requirements[0]!;
}

export async function loadAcceptanceRequirements(input: {
  projectRoot: string;
  spec?: string;
}): Promise<LoadedRequirementSet> {
  return loadTaskSpecs(input.projectRoot, input.spec);
}

async function loadTaskSpecs(
  projectRoot: string,
  selection?: string,
): Promise<LoadedRequirementSet> {
  if (selection) {
    const absolute = path.resolve(projectRoot, selection);
    try {
      if ((await fs.stat(absolute)).isDirectory()) {
        const bundleSpec = path.join(absolute, ACCEPTANCE_BUNDLE_FILENAME);
        if (await exists(bundleSpec)) return singleRequirementSet(await loadTaskSpecFile(projectRoot, bundleSpec));
        return loadTaskSpecDirectory(projectRoot, absolute);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const fileName = path.basename(absolute);
    if (!isAcceptanceSpecFileName(fileName)) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `验收用例文件必须以 ${ACCEPTANCE_SPEC_SUFFIX} 结尾：${selection}`,
      );
    }
    return singleRequirementSet(await loadTaskSpecFile(projectRoot, absolute));
  }

  const directory = path.resolve(projectRoot, ACCEPTANCE_SPEC_DIRECTORY);
  const files = await discoverTaskSpecFiles(directory);
  if (files.length > 0) return loadTaskSpecFiles(projectRoot, directory, files);
  throw new AutoE2EError(
    ExitCode.Blocked,
    `未找到验收用例。请在 ${ACCEPTANCE_SPEC_DIRECTORY} 中创建 *${ACCEPTANCE_SPEC_SUFFIX} 文件`,
  );
}

async function loadTaskSpecDirectory(
  projectRoot: string,
  directory: string,
): Promise<LoadedRequirementSet> {
  const bundleSpec = path.join(directory, ACCEPTANCE_BUNDLE_FILENAME);
  if (await exists(bundleSpec)) return singleRequirementSet(await loadTaskSpecFile(projectRoot, bundleSpec));
  const files = await discoverTaskSpecFiles(directory);
  if (files.length === 0) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `目录中没有 *${ACCEPTANCE_SPEC_SUFFIX} 文件：${directory}`,
    );
  }
  return loadTaskSpecFiles(projectRoot, directory, files);
}

async function loadTaskSpecFiles(
  projectRoot: string,
  directory: string,
  files: string[],
): Promise<LoadedRequirementSet> {
  const requirements = await Promise.all(
    files.map((file) => loadTaskSpecFile(projectRoot, path.isAbsolute(file) ? file : path.join(directory, file))),
  );
  const ids = requirements.map((item) => item.caseId);
  if (new Set(ids).size !== ids.length) {
    throw new AutoE2EError(ExitCode.Blocked, '多个验收用例文件生成了重复的 taskId');
  }
  return {
    suite: requirements.length > 1,
    title: requirements.length > 1 ? `${requirements.length} 个验收用例` : requirements[0]!.source.title,
    reference: `${path.relative(projectRoot, directory) || '.'}/*${ACCEPTANCE_SPEC_SUFFIX}`,
    requirements,
  };
}

async function loadTaskSpecFile(projectRoot: string, absolutePath: string): Promise<LoadedRequirement> {
  const raw = await readText(absolutePath, '验收用例');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `验收用例不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = validateTaskSpec(json);
  if (!parsed.success || !parsed.spec) {
    throw new AutoE2EError(ExitCode.Blocked, `验收用例校验失败：${parsed.errors.join('; ')}`);
  }
  const reference = path.relative(projectRoot, absolutePath) || path.basename(absolutePath);
  const fileName = path.basename(absolutePath);
  const inferredId = fileName === ACCEPTANCE_BUNDLE_FILENAME
    ? path.basename(path.dirname(absolutePath))
    : fileName.slice(0, -ACCEPTANCE_SPEC_SUFFIX.length);
  const fileBaseDirectory = fileName === ACCEPTANCE_BUNDLE_FILENAME
    ? path.dirname(absolutePath)
    : projectRoot;
  if (isBundleTaskSpec(parsed.spec)) {
    const specDigest = await computeBundleDigest(fileBaseDirectory, raw, parsed.spec.files ?? []);
    return {
      caseId: parsed.spec.taskId,
      source: {
        type: 'task-spec', reference, title: parsed.spec.title, content: parsed.spec.requirement,
        digest: specDigest,
      },
      criteria: numberCriteria([
        ...parsed.spec.steps.map(describeStep),
        ...parsed.spec.results.map(describeResult),
      ]),
      inputs: [],
      outputs: [],
      resources: parsed.spec.files ?? [],
      steps: parsed.spec.steps,
      results: parsed.spec.results,
      fileBaseDirectory,
      specDigest,
    };
  }
  return {
    caseId: parsed.spec.taskId ?? inferredId,
    source: { type: 'task-spec', reference, title: parsed.spec.title, content: parsed.spec.requirement },
    criteria: numberCriteria([
      ...parsed.spec.acceptanceCriteria,
      ...(parsed.spec.outputs ?? []).map(describeExpectedOutput),
    ]),
    inputs: parsed.spec.inputs ?? [],
    outputs: parsed.spec.outputs ?? [],
    resources: [],
    steps: [],
    results: [],
    fileBaseDirectory,
    specDigest: null,
  };
}

async function discoverTaskSpecFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(current: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === ACCEPTANCE_BUNDLE_FILENAME)) {
      result.push(path.join(current, ACCEPTANCE_BUNDLE_FILENAME));
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(ACCEPTANCE_SPEC_SUFFIX) && isAcceptanceSpecFileName(entry.name)) {
        result.push(absolute);
      }
    }
  }
  await walk(directory);
  return result.sort((left, right) => left.localeCompare(right));
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function singleRequirementSet(requirement: LoadedRequirement): LoadedRequirementSet {
  return {
    suite: false,
    title: requirement.source.title,
    reference: requirement.source.reference,
    requirements: [requirement],
  };
}

function numberCriteria(criteria: string[]): AcceptanceCriterionInput[] {
  return criteria.map((description, index) => ({
    id: `AC-${String(index + 1).padStart(2, '0')}`,
    description,
  }));
}

function describeExpectedOutput(
  output: TaskExpectedOutput,
): string {
  const match = output.match ?? (typeof output.expected === 'number' ? 'numeric' : 'equals');
  const expected = JSON.stringify(output.expected);
  const tolerance = match === 'numeric'
    ? `，允许绝对误差 ${output.tolerance ?? 0}`
    : '';
  const relation = match === 'contains' ? '包含' : '等于';
  return `输出“${output.name}”在“${output.location}”的值${relation} ${expected}${tolerance}`;
}

function describeStep(step: TaskStep): string {
  const files = step.uses?.length ? `；使用文件：${step.uses.join(', ')}` : '';
  return `步骤 ${step.id}：${step.instruction}${files}；完成状态：${step.expected}`;
}

function describeResult(result: TaskResult): string {
  const expected = typeof result.expected === 'object'
    ? `文件 ${result.expected.file}${result.expected.sheet ? `（工作表 ${result.expected.sheet}）` : ''}`
    : JSON.stringify(result.expected);
  return `结果 ${result.id}“${result.name}”：读取 ${result.actual}，期望 ${expected}，比较方式 ${result.match}`;
}

async function computeBundleDigest(
  bundleRoot: string,
  rawSpec: string,
  resources: TaskResource[],
): Promise<string> {
  const canonicalRoot = await fs.realpath(bundleRoot);
  const hash = createHash('sha256');
  hash.update(rawSpec);
  let totalBytes = 0;
  for (const resource of [...resources].sort((left, right) => left.id.localeCompare(right.id))) {
    if (path.isAbsolute(resource.path) || resource.path.split(/[\\/]+/).includes('..')) {
      throw new AutoE2EError(ExitCode.Blocked, `Bundle 文件必须使用目录内相对路径：${resource.path}`);
    }
    let source: string;
    try {
      source = await fs.realpath(path.resolve(canonicalRoot, resource.path));
    } catch (error) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `Bundle 文件不存在或不可读：${resource.path}（${error instanceof Error ? error.message : String(error)}）`,
        error,
      );
    }
    const relative = path.relative(canonicalRoot, source);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new AutoE2EError(ExitCode.Blocked, `Bundle 文件不能逃逸用例目录：${resource.path}`);
    }
    const stat = await fs.stat(source);
    if (!stat.isFile()) throw new AutoE2EError(ExitCode.Blocked, `Bundle 路径不是普通文件：${resource.path}`);
    if (stat.size > 100 * 1024 * 1024) {
      throw new AutoE2EError(ExitCode.Blocked, `Bundle 单文件不能超过 100 MiB：${resource.path}`);
    }
    totalBytes += stat.size;
    if (totalBytes > 500 * 1024 * 1024) {
      throw new AutoE2EError(ExitCode.Blocked, 'Bundle 引用文件总大小不能超过 500 MiB');
    }
    hash.update(resource.id);
    hash.update(resource.path);
    for await (const chunk of createReadStream(source)) hash.update(chunk);
  }
  return `sha256:${hash.digest('hex')}`;
}

async function readText(file: string, label: string): Promise<string> {
  try {
    const content = await fs.readFile(file, 'utf8');
    if (!content.trim()) {
      throw new AutoE2EError(ExitCode.Blocked, `${label} 为空：${file}`);
    }
    return content;
  } catch (error) {
    if (error instanceof AutoE2EError) throw error;
    throw new AutoE2EError(
      ExitCode.Blocked,
      `无法读取${label}：${file}（${error instanceof Error ? error.message : String(error)}）`,
      error,
    );
  }
}
