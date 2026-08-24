import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';

export const PROMPT_NAMES = [
  'analyze-requirement',
  'create-test-plan',
  'decide-exploration-action',
  'generate-test',
  'analyze-failure',
] as const;
export type PromptName = (typeof PROMPT_NAMES)[number];
const ALLOWED_VARIABLES: Record<PromptName, readonly string[]> = {
  'analyze-requirement': ['INPUT_JSON', 'KNOWLEDGE'],
  'create-test-plan': ['INPUT_JSON', 'KNOWLEDGE'],
  'decide-exploration-action': ['INPUT_JSON'],
  'generate-test': ['INPUT_JSON', 'KNOWLEDGE'],
  'analyze-failure': ['INPUT_JSON'],
};

export interface RenderedPrompt {
  content: string;
  hash: string;
  source: 'project' | 'builtin';
}

export class PromptLoader {
  constructor(private readonly projectRoot: string) {}

  async render(name: PromptName, variables: Record<string, unknown>): Promise<RenderedPrompt> {
    const projectPath = path.join(this.projectRoot, '.auto-e2e', 'prompts', `${name}.md`);
    const builtinPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prompts', `${name}.md`);
    let template: string;
    let source: RenderedPrompt['source'];
    try {
      template = await fs.readFile(projectPath, 'utf8');
      source = 'project';
    } catch {
      try {
        template = await fs.readFile(builtinPath, 'utf8');
        source = 'builtin';
      } catch (error) {
        throw new AutoE2EError(ExitCode.GenerationFailed, `无法读取 Prompt 模板 ${name}`, error);
      }
    }
    if (!template.trim()) {
      throw new AutoE2EError(ExitCode.GenerationFailed, `Prompt 模板为空：${name}`);
    }
    const placeholders = [...template.matchAll(/\{\{([A-Z][A-Z0-9_]*)\}\}/g)].map((m) => m[1]!);
    const supplied = new Set(Object.keys(variables));
    const unknownPlaceholders = [...new Set(placeholders)]
      .filter((key) => !ALLOWED_VARIABLES[name].includes(key));
    if (unknownPlaceholders.length > 0) {
      throw new AutoE2EError(
        ExitCode.GenerationFailed,
        `Prompt ${name} 包含未知变量：${unknownPlaceholders.join(', ')}`,
      );
    }
    for (const key of new Set(placeholders)) {
      if (!supplied.has(key)) {
        throw new AutoE2EError(ExitCode.GenerationFailed, `Prompt ${name} 缺少变量：${key}`);
      }
    }
    const content = template.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (_match, key: string) =>
      stableStringify(variables[key]),
    );
    return {
      content,
      source,
      hash: createHash('sha256').update(template).digest('hex'),
    };
  }
}

export function stableStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}
