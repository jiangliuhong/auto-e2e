import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import {
  AcceptanceAgentAnswerSchema,
  type AcceptanceAgentAnswer,
  type AcceptanceCriterionInput,
  type AcceptanceSource,
} from '../domain/acceptance-run.js';
import type { Logger } from '../runtime/logger.js';
import type { TaskExpectedOutput } from '../domain/task-spec.js';

const BetterWrightExecEnvelopeSchema = z.object({
  ok: z.boolean(),
  answer: z.string().default(''),
  steps: z.number().int().nonnegative().default(0),
  reason: z.string().nullish(),
  durationMs: z.number().int().nonnegative().optional(),
  proof: z.string().nullish(),
}).passthrough();

export type BetterWrightExecEnvelope = z.infer<typeof BetterWrightExecEnvelopeSchema>;

export interface BetterWrightCliOptions {
  binary?: string;
  cwd: string;
  logger?: Logger;
  env?: NodeJS.ProcessEnv;
}

export class BetterWrightCli {
  private readonly binary: string;
  private readonly prefixArgs: string[];
  private readonly cwd: string;
  private readonly logger?: Logger;
  private readonly env?: NodeJS.ProcessEnv;

  constructor(options: BetterWrightCliOptions) {
    const explicit = options.binary ?? process.env.AUTO_E2E_BETTERWRIGHT_BIN;
    if (explicit) {
      this.binary = explicit;
      this.prefixArgs = [];
    } else {
      const localCli = resolveInstalledCli();
      this.binary = localCli ? process.execPath : 'betterwright';
      this.prefixArgs = localCli ? [localCli] : [];
    }
    this.cwd = options.cwd;
    this.logger = options.logger;
    this.env = options.env;
  }

  async doctor(): Promise<unknown> {
    const result = await this.execute(['doctor', '--json']);
    if (result.exitCode !== 0) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `BetterWright 环境未就绪：${result.stderr.trim() || result.stdout.trim() || `退出码 ${result.exitCode}`}`,
      );
    }
    try {
      return JSON.parse(result.stdout);
    } catch (error) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `BetterWright doctor 未返回合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async exec(input: {
    prompt: string;
    model: string;
    profile: string;
    session: string;
    headed?: boolean;
    fresh?: boolean;
  }): Promise<BetterWrightExecEnvelope> {
    const args = [
      'exec',
      '--stdin',
      '--model',
      input.model,
      '--profile',
      input.profile,
      '--session',
      input.session,
    ];
    if (input.headed) args.push('--headed');
    if (input.fresh) args.push('--fresh');
    const result = await this.execute(args, input.prompt);
    if (!result.stdout.trim()) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `BetterWright 未返回结果：${result.stderr.trim() || `退出码 ${result.exitCode}`}`,
      );
    }
    let raw: unknown;
    try {
      raw = JSON.parse(result.stdout);
    } catch (error) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `BetterWright 返回的 stdout 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const parsed = BetterWrightExecEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `BetterWright 结果结构无效：${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
      );
    }
    return parsed.data;
  }

  private execute(args: string[], stdin?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, [...this.prefixArgs, ...args], {
        cwd: this.cwd,
        env: this.env ?? process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        for (const line of chunk.split(/\r?\n/).filter(Boolean)) this.logger?.info(line);
      });
      child.on('error', (error) => {
        reject(new AutoE2EError(
          ExitCode.Blocked,
          `无法启动 BetterWright CLI（${this.binary}）：${error.message}`,
          error,
        ));
      });
      child.on('close', (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
      if (stdin !== undefined) child.stdin.end(stdin);
      else child.stdin.end();
    });
  }
}

function resolveInstalledCli(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const packageFile = require.resolve('betterwright/package.json');
    const manifest = JSON.parse(readFileSync(packageFile, 'utf8')) as { bin?: { betterwright?: string } };
    return manifest.bin?.betterwright
      ? path.resolve(path.dirname(packageFile), manifest.bin.betterwright)
      : undefined;
  } catch {
    return undefined;
  }
}

export function buildAcceptancePrompt(input: {
  source: AcceptanceSource;
  criteria: AcceptanceCriterionInput[];
  targetUrl: string;
  forbiddenActions: string[];
  inputs?: Array<{ name: string; path: string; description?: string }>;
  outputs?: TaskExpectedOutput[];
}): string {
  const checklist = input.criteria
    .map((criterion) => `- ${criterion.id}: ${criterion.description}`)
    .join('\n');
  const forbidden = input.forbiddenActions.map((action) => `- ${action}`).join('\n');
  const fileInputs = input.inputs?.length
    ? input.inputs.map((item) =>
        `- ${item.name}：${JSON.stringify(item.path)}${item.description ? `（${item.description}）` : ''}`,
      ).join('\n')
    : '- 无';
  const expectedOutputs = input.outputs?.length
    ? input.outputs.map((output) => {
        const match = output.match ?? (typeof output.expected === 'number' ? 'numeric' : 'equals');
        const tolerance = match === 'numeric' ? `，绝对误差 <= ${output.tolerance ?? 0}` : '';
        return `- ${output.name}：位置=${JSON.stringify(output.location)}，期望=${JSON.stringify(output.expected)}，匹配=${match}${tolerance}`;
      }).join('\n')
    : '- 无额外结构化输出';
  return `你是一个严格的浏览器验收执行器。请访问 ${input.targetUrl}，根据下面的需求逐项验证。\n\n` +
    `需求来源：${input.source.reference}\n需求标题：${input.source.title}\n\n` +
    `需求正文：\n${input.source.content}\n\n` +
    `测试输入文件：\n${fileInputs}\n\n` +
    `预期输出：\n${expectedOutputs}\n\n` +
    `验收清单：\n${checklist}\n\n` +
    `安全约束：\n${forbidden || '- 不执行需求未明确授权的破坏性或高影响操作'}\n\n` +
    `执行规则：\n` +
    `1. 如有测试输入文件，必须把上面的精确绝对路径传给页面文件上传控件；不得自行构造或替换文件。\n` +
    `2. 完成需求规定的全部页面操作后，再读取页面真实可见的输出；数字按给定绝对误差比较。\n` +
    `3. 每条验收标准都必须得到 passed、failed 或 blocked 结论，不能遗漏。\n` +
    `4. 只根据页面真实可见状态判断，不得把 URL、猜测或未完成操作当成证明。\n` +
    `5. 对可见输入结果和输出结果保存 proof 截图；不能执行时说明具体阻塞原因。\n` +
    `6. 最终答案只能是 JSON，不要使用 Markdown 代码块或附加文字。结构必须为：\n` +
    `{"summary":"总体结论","criteria":[{"id":"AC-01","description":"原始标准","status":"passed|failed|blocked","actual":"实际观察","proof":"截图路径或 null"}]}\n`;
}

export function parseAcceptanceAnswer(
  answer: string,
  expected: AcceptanceCriterionInput[],
): AcceptanceAgentAnswer {
  const candidate = extractJson(answer);
  let raw: unknown;
  try {
    raw = JSON.parse(candidate);
  } catch (error) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `BetterWright 最终答案不是合法验收 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = AcceptanceAgentAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `BetterWright 验收 JSON 结构无效：${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  const expectedById = new Map(expected.map((criterion) => [criterion.id, criterion]));
  const actualIds = parsed.data.criteria.map((criterion) => criterion.id);
  if (new Set(actualIds).size !== actualIds.length ||
      actualIds.length !== expected.length ||
      actualIds.some((id) => !expectedById.has(id))) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `BetterWright 验收结果未完整覆盖清单（期望 ${expected.map((item) => item.id).join(', ')}，实际 ${actualIds.join(', ')}）`,
    );
  }
  return {
    summary: parsed.data.summary,
    criteria: parsed.data.criteria.map((criterion) => ({
      ...criterion,
      description: expectedById.get(criterion.id)!.description,
    })),
  };
}

export async function preserveProof(
  source: string | null | undefined,
  artifactDirectory: string,
  fileName = 'proof.png',
): Promise<string | null> {
  if (!source) return null;
  const absoluteSource = path.resolve(source.replace(/^media:\/\//, ''));
  try {
    await fs.access(absoluteSource);
    await fs.mkdir(artifactDirectory, { recursive: true });
    const target = path.join(artifactDirectory, fileName);
    await fs.copyFile(absoluteSource, target);
    return target;
  } catch {
    return source;
  }
}

function extractJson(answer: string): string {
  const trimmed = answer.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1];
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}
