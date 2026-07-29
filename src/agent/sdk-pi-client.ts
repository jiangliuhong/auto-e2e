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
} from './pi-client.js';
import type { TestPlan } from '../domain/test-plan.js';
import type { FailureEntry } from '../domain/test-result.js';
import { AutoE2EError } from '../runtime/exit-codes.js';
import { validateTestPlan } from '../domain/test-plan.js';
import { isFailureCategory } from '../domain/failure-category.js';

export interface SdKPiClientOptions {
  /** 自定义 system prompt 前缀。 */
  systemPrompt?: string;
}

export class SdKPiClient implements PiClient {
  constructor(private readonly opts: SdKPiClientOptions = {}) {}

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
    const prompt = buildRequirementPrompt(input);
    const raw = await this.promptJson<{
      understanding: string;
      scenarios: string[];
      identifiedRisks: string[];
    }>(prompt, 'output_requirement_analysis');
    return raw;
  }

  async createTestPlan(input: TestPlanInput): Promise<TestPlan> {
    const prompt = buildTestPlanPrompt(input);
    const raw = await this.promptJson<unknown>(prompt, 'output_test_plan');
    const result = validateTestPlan(raw);
    if (!result.success || !result.plan) {
      throw new AutoE2EError(3, `test-plan 生成校验失败：${result.errors.join('; ')}`);
    }
    return result.plan;
  }

  async generateTest(input: GenerateTestInput): Promise<GeneratedTest> {
    const prompt = buildGenerateTestPrompt(input);
    const raw = await this.promptJson<{ taskId: string; code: string; notes: string[] }>(
      prompt,
      'output_generated_test',
    );
    if (
      !raw ||
      typeof raw.taskId !== 'string' ||
      typeof raw.code !== 'string' ||
      !Array.isArray(raw.notes)
    ) {
      throw new AutoE2EError(3, '测试生成输出结构非法：需要 taskId/code/notes');
    }
    return raw;
  }

  async analyzeFailure(input: FailureAnalysisInput): Promise<FailureEntry> {
    const prompt = buildFailurePrompt(input);
    const raw = await this.promptJson<{
      test: string;
      category: string;
      message: string;
      expected?: string;
      actual?: string;
      confidence: number;
    }>(prompt, 'output_failure_analysis');
    if (!isFailureCategory(raw.category)) {
      raw.category = 'unknown';
    }
    return {
      test: input.testTitle,
      category: raw.category as FailureEntry['category'],
      message: raw.message,
      expected: raw.expected,
      actual: raw.actual,
      confidence: raw.confidence,
      artifacts: input.artifacts,
    };
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
      (event: { type: string; toolName?: string; result?: { details?: unknown } }) => {
        if (event.type === 'tool_execution_end' && event.toolName === toolName) {
          output = event.result?.details as T;
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

// 以下 prompt 构造函数与 prompts/*.md 内容保持一致，供 SDK 直接使用。
function buildRequirementPrompt(input: RequirementAnalysisInput): string {
  const s = input.taskSpec;
  return [
    `任务：${s.title}`,
    `需求：${s.requirement}`,
    `验收标准：\n- ${s.acceptanceCriteria.join('\n- ')}`,
    input.changeSummary ? `变更文件数：${input.changeSummary.fileCount}` : '',
    input.recentCommitMessage ? `最近提交：${input.recentCommitMessage}` : '',
    '输出 understanding / scenarios / identifiedRisks。',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildTestPlanPrompt(input: TestPlanInput): string {
  const s = input.taskSpec;
  return [
    `任务：${s.title}`,
    `需求：${s.requirement}`,
    `验收标准：\n- ${s.acceptanceCriteria.join('\n- ')}`,
    `变更路由：${s.changedRoutes?.join(', ') ?? ''}`,
    `需求分析：${JSON.stringify(input.analysis)}`,
    `最多生成 ${input.maxTestsPerTask} 个用例。`,
    '输出符合 test-plan 规范的 JSON（taskId/scope/testCases/uncoveredCriteria/risks）。',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildGenerateTestPrompt(input: GenerateTestInput): string {
  return [
    '根据以下完整上下文生成可直接运行的 @playwright/test TypeScript 测试。',
    `任务需求：${JSON.stringify(input.taskSpec)}`,
    `测试计划：${JSON.stringify(input.testPlan)}`,
    `页面探索结果（必须优先使用其中的稳定定位器）：${JSON.stringify(input.exploration)}`,
    `优先 testid：${input.preferTestId}`,
    'code 必须包含完整 import、测试步骤和断言；输出 taskId / code / notes。',
  ].join('\n');
}

function buildFailurePrompt(input: FailureAnalysisInput): string {
  return [
    `测试：${input.testTitle}`,
    `错误：${input.errorMessage}`,
    input.expected ? `预期：${input.expected}` : '',
    input.actual ? `实际：${input.actual}` : '',
    '输出 test/category/message/expected/actual/confidence。',
  ]
    .filter(Boolean)
    .join('\n');
}
