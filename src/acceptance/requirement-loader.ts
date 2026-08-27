import fs from 'node:fs/promises';
import path from 'node:path';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import { TaskSpecSchema } from '../domain/task-spec.js';
import type {
  AcceptanceCriterionInput,
  AcceptanceSource,
} from '../domain/acceptance-run.js';

export interface LoadedRequirement {
  source: AcceptanceSource;
  criteria: AcceptanceCriterionInput[];
}

export async function loadAcceptanceRequirement(input: {
  projectRoot: string;
  spec?: string;
  requirement?: string;
  change?: string;
}): Promise<LoadedRequirement> {
  const selected = [input.spec, input.requirement, input.change].filter(Boolean);
  if (selected.length > 1) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      '--spec、--requirement 与 --change 只能指定一个',
    );
  }

  if (input.change) return loadOpenSpecChange(input.projectRoot, input.change);
  if (input.requirement) return loadMarkdownRequirement(input.projectRoot, input.requirement);
  return loadTaskSpec(input.projectRoot, input.spec ?? '.auto-e2e/task-spec.json');
}

async function loadTaskSpec(projectRoot: string, specPath: string): Promise<LoadedRequirement> {
  const absolutePath = path.resolve(projectRoot, specPath);
  const raw = await readText(absolutePath, 'task-spec');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `task-spec 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = TaskSpecSchema.safeParse(json);
  if (!parsed.success || parsed.data.acceptanceCriteria.length === 0) {
    const detail = parsed.success
      ? 'acceptanceCriteria 不能为空'
      : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new AutoE2EError(ExitCode.Blocked, `task-spec 校验失败：${detail}`);
  }
  return {
    source: {
      type: 'task-spec',
      reference: path.relative(projectRoot, absolutePath) || path.basename(absolutePath),
      title: parsed.data.title,
      content: parsed.data.requirement,
    },
    criteria: numberCriteria(parsed.data.acceptanceCriteria),
  };
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
    source: {
      type: 'markdown',
      reference: path.relative(projectRoot, absolutePath) || path.basename(absolutePath),
      title,
      content,
    },
    criteria: numberCriteria(criteria),
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
    source: { type: 'openspec', reference: change, title: change, content },
    criteria: numberCriteria([...new Set(criteria)]),
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
