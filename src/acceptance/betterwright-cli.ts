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
import type { TaskExpectedOutput, TaskResult, TaskStep } from '../domain/task-spec.js';

const BetterWrightExecEnvelopeSchema = z.object({
  ok: z.boolean(),
  answer: z.string().default(''),
  steps: z.number().int().nonnegative().default(0),
  reason: z.string().nullish(),
  durationMs: z.number().int().nonnegative().optional(),
  proof: z.string().nullish(),
}).passthrough();

const BetterWrightRunEnvelopeSchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().nullish(),
}).passthrough();

const AgentResultValueSchema = z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.unknown()),
]);

const BundleAgentAnswerSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(z.object({
    id: z.string().regex(/^STEP-\d{2,}$/),
    status: z.enum(['passed', 'failed', 'blocked', 'skipped']),
    actual: z.string().min(1),
    proof: z.string().min(1).nullable().default(null),
    durationMs: z.number().int().nonnegative().optional(),
    error: z.string().min(1).nullable().default(null),
  }).strict()).min(1),
  results: z.array(z.object({
    id: z.string().regex(/^RESULT-\d{2,}$/),
    status: z.enum(['observed', 'matched', 'mismatched', 'blocked']),
    actual: AgentResultValueSchema,
    proof: z.string().min(1).nullable().default(null),
    error: z.string().min(1).nullable().default(null),
  }).strict()).min(1),
}).strict();

export type BundleAgentAnswer = z.infer<typeof BundleAgentAnswerSchema>;

export const BetterWrightDoctorCheckSchema = z.object({
  group: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(['ok', 'warn', 'fail']),
  detail: z.string(),
  fix: z.string().nullish(),
}).passthrough();

export const BetterWrightDoctorReportSchema = z.object({
  ready: z.boolean(),
  browser: z.string().nullish(),
  browser_selection_reason: z.string().nullish(),
  playwright_version: z.string().nullish(),
  checks: z.array(BetterWrightDoctorCheckSchema),
}).passthrough();

export type BetterWrightDoctorReport = z.infer<typeof BetterWrightDoctorReportSchema>;

export type BetterWrightExecEnvelope = z.infer<typeof BetterWrightExecEnvelopeSchema>;

export interface BetterWrightManualLoginSession {
  viewerUrl: string;
  close(): Promise<void>;
}

export type BetterWrightLiveViewSession = BetterWrightManualLoginSession;

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

  async doctor(): Promise<BetterWrightDoctorReport> {
    const result = await this.execute(['doctor', '--json']);
    if (result.exitCode !== 0) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `BetterWright 环境未就绪：${result.stderr.trim() || result.stdout.trim() || `退出码 ${result.exitCode}`}`,
      );
    }
    try {
      const raw: unknown = JSON.parse(result.stdout);
      const parsed = BetterWrightDoctorReportSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AutoE2EError(
          ExitCode.Blocked,
          `BetterWright doctor 结果结构无效：${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof AutoE2EError) throw error;
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
    signal?: AbortSignal;
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
    const result = await this.execute(args, input.prompt, input.signal);
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

  async startManualLogin(input: {
    targetUrl: string;
    profile: string;
    session: string;
    headed?: boolean;
  }): Promise<BetterWrightManualLoginSession> {
    const commonArgs = [
      '--profile',
      input.profile,
      '--session',
      input.session,
    ];
    if (input.headed) commonArgs.push('--headed');

    const viewer = await this.startLiveView({
      profile: input.profile,
      session: input.session,
      headed: input.headed,
    });
    try {
      const script = [
        `const targetUrl = ${JSON.stringify(input.targetUrl)};`,
        'await page.goto(targetUrl);',
        'return { url: page.url(), title: await page.title() };',
      ].join('\n');
      const result = await this.execute(['run', '-', ...commonArgs], script);
      let raw: unknown;
      try {
        raw = JSON.parse(result.stdout);
      } catch (error) {
        throw new AutoE2EError(
          ExitCode.Blocked,
          `BetterWright 手动登录浏览器未返回合法 JSON：${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const parsed = BetterWrightRunEnvelopeSchema.safeParse(raw);
      if (result.exitCode !== 0 || !parsed.success || !parsed.data.ok) {
        const detail = parsed.success
          ? parsed.data.error
          : parsed.error.issues.map((issue) => issue.message).join('; ');
        throw new AutoE2EError(
          ExitCode.Blocked,
          `无法打开手动登录目标页面：${detail || result.stderr.trim() || `退出码 ${result.exitCode}`}`,
        );
      }
      return viewer;
    } catch (error) {
      await viewer.close();
      throw error;
    }
  }

  startLiveView(input: {
    profile: string;
    session: string;
    headed?: boolean;
    signal?: AbortSignal;
  }): Promise<BetterWrightLiveViewSession> {
    const args = [
      'view',
      '--profile',
      input.profile,
      '--session',
      input.session,
      '--expose',
      'local',
    ];
    if (input.headed) args.push('--headed');
    return this.startViewer(args, input.signal);
  }

  private startViewer(args: string[], signal?: AbortSignal): Promise<BetterWrightManualLoginSession> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new AutoE2EError(ExitCode.Blocked, 'BetterWright Live View 已取消'));
        return;
      }
      const child = spawn(this.binary, [...this.prefixArgs, ...args], {
        cwd: this.cwd,
        env: this.env ?? process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let closed: Promise<void> | undefined;
      const close = (): Promise<void> => {
        if (closed) return closed;
        closed = new Promise<void>((done) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            done();
            return;
          }
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
          }, 3_000);
          timer.unref();
          child.once('close', () => {
            clearTimeout(timer);
            done();
          });
          child.kill('SIGTERM');
        });
        return closed;
      };
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        void close();
        reject(error);
      };
      const onAbort = (): void => fail(new AutoE2EError(
        ExitCode.Blocked,
        'BetterWright Live View 已取消',
      ));
      const inspectOutput = (): void => {
        if (settled) return;
        const plain = stdout.replace(/\u001b\[[0-9;]*m/g, '');
        const viewerUrl = plain.match(/Live view:\s+(https?:\/\/\S+)/)?.[1];
        if (!viewerUrl) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve({ viewerUrl, close });
      };
      const timer = setTimeout(() => {
        fail(new AutoE2EError(
          ExitCode.Blocked,
          `启动手动登录窗口超时：${stderr.trim() || 'BetterWright 未返回 Live View 地址'}`,
        ));
      }, 15_000);
      timer.unref();
      signal?.addEventListener('abort', onAbort, { once: true });
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        inspectOutput();
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        for (const line of chunk.split(/\r?\n/).filter(Boolean)) this.logger?.info(line);
      });
      child.once('error', (error) => {
        fail(new AutoE2EError(
          ExitCode.Blocked,
          `无法启动 BetterWright CLI（${this.binary}）：${error.message}`,
          error,
        ));
      });
      child.once('close', (code) => {
        if (!settled) {
          fail(new AutoE2EError(
            ExitCode.Blocked,
            `BetterWright Live View 提前退出：${stderr.trim() || `退出码 ${code ?? 1}`}`,
          ));
        }
      });
    });
  }

  private execute(
    args: string[],
    stdin?: string,
    signal?: AbortSignal,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new AutoE2EError(ExitCode.Blocked, 'BetterWright 运行已取消'));
        return;
      }
      const child = spawn(this.binary, [...this.prefixArgs, ...args], {
        cwd: this.cwd,
        env: this.env ?? process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });
      let stdout = '';
      let stderr = '';
      let killTimer: NodeJS.Timeout | undefined;
      const cleanup = (): void => {
        signal?.removeEventListener('abort', onAbort);
        if (killTimer) clearTimeout(killTimer);
      };
      const onAbort = (): void => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill('SIGINT');
        killTimer = setTimeout(() => child.kill('SIGKILL'), 3_000);
        killTimer.unref();
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        for (const line of chunk.split(/\r?\n/).filter(Boolean)) this.logger?.info(line);
      });
      child.on('error', (error) => {
        cleanup();
        reject(new AutoE2EError(
          ExitCode.Blocked,
          `无法启动 BetterWright CLI（${this.binary}）：${error.message}`,
          error,
        ));
      });
      child.on('close', (code) => {
        cleanup();
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });
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
  resources?: Array<{ id: string; name?: string; role: 'input' | 'expected' | 'reference'; path: string }>;
  workflowSteps?: TaskStep[];
  results?: TaskResult[];
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
  const resources = input.resources?.length
    ? input.resources.map((resource) =>
        `- ${resource.id}：角色=${resource.role}，文件=${JSON.stringify(resource.path)}${resource.name ? `，名称=${resource.name}` : ''}`,
      ).join('\n')
    : '- 无';
  const workflow = input.workflowSteps?.length
    ? input.workflowSteps.map((step) =>
        `- ${step.id}：${step.instruction}${step.uses?.length ? `；使用资源=${step.uses.join(', ')}` : ''}；完成状态=${step.expected}`,
      ).join('\n')
    : '- 使用需求正文与验收清单完成操作';
  const structuredResults = input.results?.length
    ? input.results.map((result) => {
        const expected = typeof result.expected === 'object'
          ? `资源=${result.expected.file}${result.expected.sheet ? `，工作表=${result.expected.sheet}` : ''}`
          : JSON.stringify(result.expected);
        return `- ${result.id} ${result.name}：读取=${result.actual}；期望=${expected}；比较=${result.match}${result.options ? `；选项=${JSON.stringify(result.options)}` : ''}`;
      }).join('\n')
    : '- 无额外结构化结果';
  const answerShape = input.workflowSteps?.length
    ? `{"summary":"总体结论","steps":[{"id":"STEP-01","status":"passed|failed|blocked|skipped","actual":"实际观察","proof":"截图路径或 null","durationMs":0,"error":null}],"results":[{"id":"RESULT-01","status":"observed|matched|mismatched|blocked","actual":"页面实际值或结构化值","proof":"截图路径或 null","error":null}]}`
    : `{"summary":"总体结论","criteria":[{"id":"AC-01","description":"原始标准","status":"passed|failed|blocked","actual":"实际观察","proof":"截图路径或 null"}]}`;
  return `你是一个严格的浏览器验收执行器。请访问 ${input.targetUrl}，根据下面的需求逐项验证。\n\n` +
    `需求来源：${input.source.reference}\n需求标题：${input.source.title}\n\n` +
    `需求正文：\n${input.source.content}\n\n` +
    `测试输入文件：\n${fileInputs}\n\n` +
    `预期输出：\n${expectedOutputs}\n\n` +
    `Spec Bundle 文件资源：\n${resources}\n\n` +
    `业务步骤（必须按顺序执行）：\n${workflow}\n\n` +
    `最终结果：\n${structuredResults}\n\n` +
    `验收清单：\n${checklist}\n\n` +
    `安全约束：\n${forbidden || '- 不执行需求未明确授权的破坏性或高影响操作'}\n\n` +
    `执行规则：\n` +
    `1. 如有测试输入文件，必须把上面的精确绝对路径传给页面文件上传控件；不得自行构造或替换文件。\n` +
    `2. 对 Spec Bundle，input 资源只能在对应步骤使用；expected 资源只能用于结果比较，不得上传到被测系统。\n` +
    `3. 必须按业务步骤的声明顺序执行；当前步骤完成状态成立后才能进入下一步。前一步未通过时，不得继续产生副作用。\n` +
    `4. 完成全部页面操作后，再读取页面真实可见的输出；数字按给定绝对误差比较。\n` +
    `5. 每条验收标准都必须得到 passed、failed 或 blocked 结论，不能遗漏。\n` +
    `6. 只根据页面真实可见状态判断，不得把 URL、猜测或未完成操作当成证明。\n` +
    `7. 对每个业务步骤完成状态和最终结果保存 proof 截图；不能执行时说明具体阻塞原因。\n` +
    `8. equals、contains、numeric 结果只读取 actual 并返回 observed，不得自行判定是否匹配；visual、table、file 由你比较并返回 matched 或 mismatched。无法读取时返回 blocked。\n` +
    `9. 最终答案只能是 JSON，不要使用 Markdown 代码块或附加文字。结构必须为：\n` +
    `${answerShape}\n`;
}

export function parseBundleAcceptanceAnswer(
  answer: string,
  expectedSteps: TaskStep[],
  expectedResults: TaskResult[],
): BundleAgentAnswer {
  const candidate = extractJson(answer);
  let raw: unknown;
  try {
    raw = JSON.parse(candidate);
  } catch (error) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `BetterWright 最终答案不是合法 Bundle 验收 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = BundleAgentAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `BetterWright Bundle 验收 JSON 结构无效：${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  assertOrderedIds('步骤', expectedSteps.map((item) => item.id), parsed.data.steps.map((item) => item.id));
  assertOrderedIds('结果', expectedResults.map((item) => item.id), parsed.data.results.map((item) => item.id));
  let stopped = false;
  parsed.data.steps.forEach((step) => {
    if (!stopped && step.status === 'skipped') {
      throw new AutoE2EError(ExitCode.Blocked, `步骤 ${step.id} 不能在前置步骤失败或阻塞前跳过`);
    }
    if (stopped && step.status !== 'skipped') {
      throw new AutoE2EError(ExitCode.Blocked, `前置步骤未通过后，步骤 ${step.id} 必须为 skipped`);
    }
    if (step.status === 'failed' || step.status === 'blocked') stopped = true;
  });
  if (stopped) {
    const completedResult = parsed.data.results.find((result) => result.status !== 'blocked');
    if (completedResult) {
      throw new AutoE2EError(
        ExitCode.Blocked,
        `业务步骤未全部通过时，结果 ${completedResult.id} 必须为 blocked`,
      );
    }
  }
  return parsed.data;
}

function assertOrderedIds(label: string, expected: string[], actual: string[]): void {
  if (expected.length !== actual.length || expected.some((id, index) => actual[index] !== id)) {
    throw new AutoE2EError(
      ExitCode.Blocked,
      `BetterWright ${label}未按规格完整有序覆盖（期望 ${expected.join(', ')}，实际 ${actual.join(', ')}）`,
    );
  }
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
  allowedSourceRoots: string[] = [artifactDirectory],
  sourceBaseDirectory = process.cwd(),
): Promise<string | null> {
  if (!source) return null;
  const absoluteSource = path.resolve(sourceBaseDirectory, source.replace(/^media:\/\//, ''));
  try {
    const realSource = await fs.realpath(absoluteSource);
    const allowedRoots = await Promise.all(allowedSourceRoots.map(async (root) => {
      try {
        return await fs.realpath(root);
      } catch {
        return path.resolve(root);
      }
    }));
    if (!allowedRoots.some((root) => isWithinDirectory(root, realSource))) return null;
    const stat = await fs.stat(realSource);
    if (!stat.isFile() || stat.size <= 0 || stat.size > 25 * 1024 * 1024) return null;
    const imageType = await detectProofImageType(realSource);
    if (!imageType) return null;
    await fs.mkdir(artifactDirectory, { recursive: true });
    const target = path.join(
      artifactDirectory,
      `${path.basename(fileName, path.extname(fileName))}.${imageType}`,
    );
    if (path.resolve(realSource) === path.resolve(target)) return target;
    await fs.copyFile(realSource, target);
    return target;
  } catch {
    return null;
  }
}

function isWithinDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function detectProofImageType(file: string): Promise<'png' | 'jpg' | 'webp' | null> {
  const handle = await fs.open(file, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return 'png';
    }
    if (bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'jpg';
    if (bytesRead >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') {
      return 'webp';
    }
    return null;
  } finally {
    await handle.close();
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
