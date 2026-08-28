import fs from 'node:fs/promises';
import path from 'node:path';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import {
  ACCEPTANCE_SPEC_DIRECTORY,
  ACCEPTANCE_SPEC_SUFFIX,
  isAcceptanceSpecFileName,
  TaskSpecSchema,
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
  requirement?: string;
  change?: string;
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
  requirement?: string;
  change?: string;
}): Promise<LoadedRequirementSet> {
  const selected = [input.spec, input.requirement, input.change].filter(Boolean);
  if (selected.length > 1) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      '--spec、--requirement 与 --change 只能指定一个',
    );
  }

  if (input.change) return singleRequirementSet(await loadOpenSpecChange(input.projectRoot, input.change));
  if (input.requirement) return singleRequirementSet(await loadMarkdownRequirement(input.projectRoot, input.requirement));
  return loadTaskSpecs(input.projectRoot, input.spec);
}

async function loadTaskSpecs(
  projectRoot: string,
  selection?: string,
): Promise<LoadedRequirementSet> {
  if (selection) {
    const absolute = path.resolve(projectRoot, selection);
    try {
      if ((await fs.stat(absolute)).isDirectory()) return loadTaskSpecDirectory(projectRoot, absolute);
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
  const files = await listAcceptanceSpecFiles(directory);
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
  const files = await listAcceptanceSpecFiles(directory);
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
    files.map((fileName) => loadTaskSpecFile(projectRoot, path.join(directory, fileName))),
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
  const parsed = TaskSpecSchema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new AutoE2EError(ExitCode.Blocked, `验收用例校验失败：${detail}`);
  }
  const reference = path.relative(projectRoot, absolutePath) || path.basename(absolutePath);
  const fileName = path.basename(absolutePath);
  const inferredId = fileName.slice(0, -ACCEPTANCE_SPEC_SUFFIX.length);
  return {
    caseId: parsed.data.taskId ?? inferredId,
    source: { type: 'task-spec', reference, title: parsed.data.title, content: parsed.data.requirement },
    criteria: numberCriteria([
      ...parsed.data.acceptanceCriteria,
      ...(parsed.data.outputs ?? []).map(describeExpectedOutput),
    ]),
    inputs: parsed.data.inputs ?? [],
    outputs: parsed.data.outputs ?? [],
  };
}

async function listAcceptanceSpecFiles(directory: string): Promise<string[]> {
  try {
    return (await fs.readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && isAcceptanceSpecFileName(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function loadMarkdownRequirement(
  projectRoot: string,
  requirementPath: string,
): Promise<LoadedRequirement> {
  const absolutePath = path.resolve(projectRoot, requirementPath);
  const content = await readText(absolutePath, '需求文件');
  const title = extractTitle(content) ?? path.basename(absolutePath, path.extname(absolutePath));
  const criteria = extractAcceptanceCriteria(content);
  if (criteria.length === 0) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      'Markdown 需求中未找到验收标准。请使用“验收标准”标题和列表编写可验证条目。',
    );
  }
  return {
    caseId: 'CASE-01',
    source: {
      type: 'markdown',
      reference: path.relative(projectRoot, absolutePath) || path.basename(absolutePath),
      title,
      content,
    },
    criteria: numberCriteria(criteria),
    inputs: [],
    outputs: [],
  };
}

async function loadOpenSpecChange(projectRoot: string, change: string): Promise<LoadedRequirement> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(change) || change.includes('..')) {
    throw new AutoE2EError(ExitCode.Blocked, `非法 OpenSpec change 名称：${change}`);
  }
  const changeRoot = path.join(projectRoot, 'openspec', 'changes', change);
  const files = await collectMarkdownFiles(changeRoot);
  if (files.length === 0) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `OpenSpec change 不存在或没有 Markdown artifacts：${change}`,
    );
  }
  const documents = await Promise.all(
    files.map(async (file) => ({ file, content: await readText(file, 'OpenSpec artifact') })),
  );
  const content = documents
    .map(({ file, content: body }) => `# ${path.relative(changeRoot, file)}\n\n${body}`)
    .join('\n\n---\n\n');
  const criteria = documents.flatMap(({ content: body }) => extractAcceptanceCriteria(body));
  if (criteria.length === 0) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `OpenSpec change ${change} 中未找到 Requirement/Scenario 或验收标准列表`,
    );
  }
  return {
    caseId: 'CASE-01',
    source: { type: 'openspec', reference: change, title: change, content },
    criteria: numberCriteria([...new Set(criteria)]),
    inputs: [],
    outputs: [],
  };
}

function singleRequirementSet(requirement: LoadedRequirement): LoadedRequirementSet {
  return {
    suite: false,
    title: requirement.source.title,
    reference: requirement.source.reference,
    requirements: [requirement],
  };
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(directory: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name.endsWith('.md')) result.push(absolute);
    }
  }
  await walk(root);
  return result;
}

export function extractAcceptanceCriteria(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const criteria: string[] = [];
  let inCriteriaSection = false;
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      const name = heading[1]!.trim();
      const isScenario = /^scenario\s*:/i.test(name);
      inCriteriaSection = !isScenario && /(验收|acceptance criteria)/i.test(name);
      if (isScenario) criteria.push(name.replace(/^scenario\s*:\s*/i, '').trim());
      continue;
    }
    const scenario = line.match(/^\s*[-*]?\s*Scenario\s*:\s*(.+)$/i);
    if (scenario) {
      criteria.push(scenario[1]!.trim());
      continue;
    }
    if (inCriteriaSection) {
      const item = line.match(/^\s*(?:[-*+] |\d+[.)]\s+|\[[ xX]\]\s+)(.+?)\s*$/);
      if (item?.[1]) criteria.push(item[1].trim());
    }
  }
  return criteria.filter(Boolean);
}

function extractTitle(markdown: string): string | undefined {
  return markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
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
