import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import type { TaskSpec } from '../domain/task-spec.js';
import type { KnowledgeConfig } from '../config/config-schema.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';

const KNOWLEDGE_NAMES = ['login', 'table', 'pagination'] as const;

export interface SelectedKnowledge {
  content: string;
  hashes: Record<string, string>;
}

export class KnowledgeLoader {
  constructor(private readonly projectRoot: string, private readonly config: KnowledgeConfig) {}

  async select(taskSpec: TaskSpec): Promise<SelectedKnowledge> {
    if (!this.config.enabled) return { content: '', hashes: {} };
    const haystack = [
      taskSpec.title, taskSpec.requirement, ...taskSpec.acceptanceCriteria,
      ...(taskSpec.changedRoutes ?? []),
    ].join(' ').toLowerCase();
    const candidates: Array<{ name: string; raw: string; body: string; score: number }> = [];
    for (const name of KNOWLEDGE_NAMES) {
      const loaded = await this.load(name);
      if (!loaded) continue;
      const score = loaded.keywords.filter((word) => haystack.includes(word.toLowerCase())).length;
      if (score > 0) candidates.push({ name, raw: loaded.raw, body: loaded.body, score });
    }
    candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    let remaining = this.config.maxCharacters;
    const chunks: string[] = [];
    const hashes: Record<string, string> = {};
    for (const item of candidates.slice(0, this.config.maxFiles)) {
      const body = item.body.slice(0, remaining);
      if (!body) break;
      chunks.push(`## Knowledge: ${item.name}\n\n${body}`);
      hashes[item.name] = createHash('sha256').update(item.raw).digest('hex');
      remaining -= body.length;
    }
    return { content: chunks.join('\n\n'), hashes };
  }

  private async load(name: string): Promise<{ raw: string; body: string; keywords: string[] } | undefined> {
    const projectPath = path.join(this.projectRoot, '.auto-e2e', 'knowledge', `${name}.md`);
    const builtinPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'knowledge', `${name}.md`);
    let raw: string;
    try { raw = await fs.readFile(projectPath, 'utf8'); }
    catch {
      try { raw = await fs.readFile(builtinPath, 'utf8'); }
      catch { return undefined; }
    }
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(raw);
    if (!match) {
      throw new AutoE2EError(ExitCode.GenerationFailed, `Knowledge 文件缺少合法 front matter：${name}`);
    }
    const meta = YAML.parse(match[1]!) as { keywords?: unknown };
    if (!Array.isArray(meta.keywords) || !meta.keywords.every((v) => typeof v === 'string')) {
      throw new AutoE2EError(ExitCode.GenerationFailed, `Knowledge keywords 非法：${name}`);
    }
    return { raw, body: match[2]!.trim(), keywords: meta.keywords };
  }
}
