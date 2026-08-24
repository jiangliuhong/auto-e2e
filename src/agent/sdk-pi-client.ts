/**
 * SdKPiClient：真实接入 Pi SDK（@earendil-works/pi-coding-agent）。
 *
 * 通过 createAgentSession + defineTool 实现结构化输出：
 * - 用 defineTool 定义一个 output_* 工具，其 parameters 用 TypeBox 描述目标结构。
 * - prompt 中要求模型调用该工具产出结构化结果。
 * - 从 tool_execution_end 事件的 details 取出结构化 JSON，再用 Zod 校验。
 *
 * 注意：Pi SDK 为可选依赖，未安装时本类不可用（运行时按配置 agent.implementation=sdk 才尝试加载）。
 * 因此采用动态 import，避免在 mock 模式下强依赖该包。
 */
import type {
  PiClient,
  AuthStatus,
  RequirementAnalysisInput,
  RequirementAnalysis,
  TestPlanInput,
  GenerateTestInput,
  GeneratedTest,
  FailureAnalysisInput,
  PiTelemetrySnapshot,
} from './pi-client.js';
import type { TestPlan } from '../domain/test-plan.js';
import type { FailureEntry } from '../domain/test-result.js';
import { AutoE2EError } from '../runtime/exit-codes.js';
import { TestCaseSchema, TestPlanSchema } from '../domain/test-plan.js';
import { FailureEntrySchema } from '../domain/test-result.js';
import { z } from 'zod';
import { PromptLoader, type PromptName } from './prompt-loader.js';
import { KnowledgeLoader } from './knowledge-loader.js';
import type { KnowledgeConfig } from '../config/config-schema.js';
import {
  ExplorationDecisionSchema,
  type ExplorationDecision,
  type ExplorationDecisionInput,
} from '../domain/exploration-action.js';

export interface SdKPiClientOptions {
  /** 自定义 system prompt 前缀。 */
  systemPrompt?: string;
  projectRoot?: string;
  knowledge?: KnowledgeConfig;
}

/**
 * 模型偶尔会把只有一项的 expected 压缩成字符串。仅在 AI 适配器边界兼容
 * 这种无歧义的表示，转换后仍由领域 TestPlanSchema 完整校验。
 */
export const ModelTestPlanSchema = TestPlanSchema.extend({
  testCases: z.array(
    TestCaseSchema.extend({
      expected: z
        .union([z.array(z.string().min(1)), z.string().min(1)])
        .transform((value) => (Array.isArray(value) ? value : [value])),
    }),
  ).min(1),
});

export class SdKPiClient implements PiClient {
  private readonly loader: PromptLoader;
  private readonly knowledgeLoader: KnowledgeLoader;
  private readonly telemetry: PiTelemetrySnapshot = {
    calls: 0, retries: 0, durationMs: 0, tokenUsage: null,
    promptHashes: {}, knowledgeHashes: {},
  };

  constructor(private readonly opts: SdKPiClientOptions = {}) {
    this.loader = new PromptLoader(opts.projectRoot ?? process.cwd());
    this.knowledgeLoader = new KnowledgeLoader(
      opts.projectRoot ?? process.cwd(),
      opts.knowledge ?? { enabled: false, maxFiles: 3, maxCharacters: 12000 },
    );
  }

  /**
   * 动态加载 Pi SDK。未安装时抛 AuthFailed（提示用户运行 auth login 或安装 SDK）。
   */
  private async loadSdk(): Promise<typeof import('@earendil-works/pi-coding-agent')> {
    try {
      return await import('@earendil-works/pi-coding-agent');
    } catch {
      throw new AutoE2EError(
        5,
        '未找到 Pi SDK（@earendil-works/pi-coding-agent）。请先安装该包并执行 `auto-e2e auth login`。',
      );
    }
  }

  async checkAuth(): Promise<AuthStatus> {
    const sdk = await this.loadSdk();
    try {
      const runtime = await sdk.ModelRuntime.create();
      const providers = runtime.getProviders();
      for (const provider of providers) {
        const status = await runtime.checkAuth(provider.id);
        if (status) {
          return { authenticated: true, provider: provider.name };
        }
      }
      return { authenticated: false, message: '未找到已认证的提供商，请执行 auto-e2e auth login' };
    } catch (err) {
      return {
        authenticated: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async login(): Promise<AuthStatus> {
    // 真实 OAuth 需交互式流程，SDK 通过 CLI /login 完成。
    // 这里提供引导信息；非交互模式下禁止触发需要密码的流程（plan §18）。
    return {
      authenticated: false,
      message:
        '请在交互式终端运行 `pi /login` 选择 ChatGPT Plus/Pro (Codex) 完成登录，token 将存于 ~/.pi/agent/auth.json。',
    };
  }

  async analyzeRequirement(input: RequirementAnalysisInput): Promise<RequirementAnalysis> {
    return this.callValidated<RequirementAnalysis>(
      'analyze-requirement',
      await this.variables(input),
      'output_requirement_analysis',
      z.object({
        understanding: z.string(),
        scenarios: z.array(z.string()),
        identifiedRisks: z.array(z.string()),
      }),
    );
  }

  async createTestPlan(input: TestPlanInput): Promise<TestPlan> {
    return this.callValidated<TestPlan>(
      'create-test-plan',
      await this.variables(input),
      'output_test_plan',
      ModelTestPlanSchema,
    );
  }

  async generateTest(input: GenerateTestInput): Promise<GeneratedTest> {
    return this.callValidated(
      'generate-test',
      await this.variables(input),
      'output_generated_test',
      z.object({ taskId: z.string(), code: z.string(), notes: z.array(z.string()) }),
    );
  }

  async decideExplorationAction(
    input: ExplorationDecisionInput,
  ): Promise<ExplorationDecision> {
    return this.callValidated(
      'decide-exploration-action',
      { INPUT_JSON: input },
      'output_exploration_action',
      ExplorationDecisionSchema,
    );
  }

  async analyzeFailure(input: FailureAnalysisInput): Promise<FailureEntry> {
    const raw = await this.callValidated(
      'analyze-failure',
      { INPUT_JSON: input },
      'output_failure_analysis',
      FailureEntrySchema.omit({ artifacts: true }).extend({ test: z.string() }),
    );
    return { ...raw, test: input.testTitle, artifacts: input.artifacts };
  }

  getTelemetry(): PiTelemetrySnapshot {
    return structuredClone(this.telemetry);
  }

  private async variables(
    input: { taskSpec: import('../domain/task-spec.js').TaskSpec },
  ): Promise<Record<string, unknown>> {
    const selected = await this.knowledgeLoader.select(input.taskSpec);
    Object.assign(this.telemetry.knowledgeHashes, selected.hashes);
    return { INPUT_JSON: input, KNOWLEDGE: selected.content || '无匹配知识文件。' };
  }

  private async callValidated<T>(
    name: PromptName,
    variables: Record<string, unknown>,
    toolName: string,
    schema: {
      safeParse(value: unknown):
        | { success: true; data: T }
        | { success: false; error: z.ZodError };
    },
  ): Promise<T> {
    const started = Date.now();
    this.telemetry.calls++;
    const rendered = await this.loader.render(name, variables);
    this.telemetry.promptHashes[name] = rendered.hash;
    try {
      let lastErrors = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        const suffix = attempt === 0 ? '' : `\n\n上一次输出不合法：${lastErrors}。请修正后重新输出。`;
        const raw = await this.promptJson<unknown>(rendered.content + suffix, toolName);
        const parsed = schema.safeParse(raw);
        if (parsed.success) return parsed.data;
        lastErrors = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
        if (attempt === 0) this.telemetry.retries++;
      }
      throw new AutoE2EError(3, `模型输出校验失败：${lastErrors}`);
    } finally {
      this.telemetry.durationMs += Date.now() - started;
    }
  }

  /**
   * 通用结构化 prompt：定义 output 工具，要求模型调用并返回 details。
   * 输出非法时由调用方通过 withRetry 重试（此处仅单次调用）。
   */
  private async promptJson<T>(userPrompt: string, toolName: string): Promise<T> {
    const sdk = await this.loadSdk();
    const { Type } = await import('@sinclair/typebox');

    const outputTool = sdk.defineTool({
      name: toolName,
      label: toolName,
      description: '输出本次结构化结果',
      // TypeBox Unknown 等价于任意 JSON；真实结构由调用方 Zod 校验。
      parameters: Type.Object({}, { additionalProperties: true }),
      execute: async (_id: string, params: unknown) => ({
        content: [{ type: 'text' as const, text: 'received' }],
        details: params,
      }),
    });

    const modelRuntime = await sdk.ModelRuntime.create();
    const { session } = await sdk.createAgentSession({
      modelRuntime,
      sessionManager: sdk.SessionManager.inMemory(),
      customTools: [outputTool],
      tools: [toolName],
    });

    let output: T | undefined;
    const unsubscribe = session.subscribe(
      (event) => {
        if (event.type === 'tool_execution_end' && event.toolName === toolName) {
          output = event.result?.details as T;
        }
        if (
          event.type === 'turn_end' &&
          event.message.role === 'assistant' &&
          typeof event.message.usage.totalTokens === 'number'
        ) {
          this.telemetry.tokenUsage =
            (this.telemetry.tokenUsage ?? 0) + event.message.usage.totalTokens;
        }
      },
    );
    try {
      await session.prompt(
        `${this.opts.systemPrompt ?? ''}\n\n${userPrompt}\n\n请调用 ${toolName} 工具输出结构化结果。`,
      );
      if (output === undefined) {
        throw new AutoE2EError(3, `模型未调用 ${toolName} 输出结构化结果`);
      }
      return output;
    } finally {
      unsubscribe();
      session.dispose();
    }
  }
}
