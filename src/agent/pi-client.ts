/**
 * PiClient 接口：所有 AI 生成能力都通过此接口，便于在 Mock / SDK 实现间切换。
 *
 * plan §3.2：Pi 负责
 * - ChatGPT OAuth 登录
 * - 需求理解
 * - 测试计划生成
 * - Playwright 测试代码生成
 * - 失败分析
 * - 报告摘要生成
 *
 * 每个方法返回经 Zod 校验的结构化结果；输出不合法时最多重试一次。
 */
import type { TaskSpec } from '../domain/task-spec.js';
import type { TestPlan } from '../domain/test-plan.js';
import type { ExploreResult } from '../domain/explore-result.js';
import type { FailureEntry } from '../domain/test-result.js';

/** 需求分析的上下文输入。 */
export interface RequirementAnalysisInput {
  taskSpec: TaskSpec;
  /** 规则归纳的变更概要（来自 git/change-analyzer）。 */
  changeSummary?: {
    fileCount: number;
    routeFiles: string[];
    apiFiles: string[];
  };
  recentCommitMessage?: string;
}

/** 需求分析输出：结构化的测试范围与风险理解。 */
export interface RequirementAnalysis {
  /** 对需求的一句话理解。 */
  understanding: string;
  /** 关键测试场景描述。 */
  scenarios: string[];
  /** 识别到的风险点。 */
  identifiedRisks: string[];
}

/** 测试计划生成输入。 */
export interface TestPlanInput {
  taskSpec: TaskSpec;
  analysis: RequirementAnalysis;
  maxTestsPerTask: number;
}

/** 测试代码生成输入。 */
export interface GenerateTestInput {
  taskSpec: TaskSpec;
  testPlan: TestPlan;
  exploration: ExploreResult;
  preferTestId: boolean;
}

export interface GeneratedTest {
  /** taskId，用于命名。 */
  taskId: string;
  /** 生成的 TypeScript 测试文件内容。 */
  code: string;
  /** 生成说明（使用了哪些定位器策略等）。 */
  notes: string[];
}

/** 失败分析输入。 */
export interface FailureAnalysisInput {
  testTitle: string;
  errorMessage: string;
  errorStack?: string;
  expected?: string;
  actual?: string;
  artifacts?: { screenshot?: string; trace?: string; video?: string };
}

/** 认证状态。 */
export interface AuthStatus {
  authenticated: boolean;
  /** 提供商名称，例如 ChatGPT Plus/Pro (Codex)。 */
  provider?: string;
  message?: string;
}

export interface PiClient {
  /** 检查 ChatGPT OAuth 登录状态。 */
  checkAuth(): Promise<AuthStatus>;

  /** 触发 OAuth 登录流程（交互式）。 */
  login(): Promise<AuthStatus>;

  /** 需求理解。 */
  analyzeRequirement(input: RequirementAnalysisInput): Promise<RequirementAnalysis>;

  /** 生成 test-plan。 */
  createTestPlan(input: TestPlanInput): Promise<TestPlan>;

  /** 生成 Playwright 测试代码。 */
  generateTest(input: GenerateTestInput): Promise<GeneratedTest>;

  /** 失败分类。 */
  analyzeFailure(input: FailureAnalysisInput): Promise<FailureEntry>;
}

/**
 * 包装一个「调用模型 + 解析 + Zod 校验」的通用流程。
 * 输出不合法时最多重试一次（带修正提示）。
 */
export async function withRetry<T>(
  attempt: (retryHint?: string) => Promise<T>,
  validate: (value: T) => { success: boolean; errors: string[] },
): Promise<T> {
  const first = await attempt();
  const firstCheck = validate(first);
  if (firstCheck.success) return first;
  // 重试一次，把错误反馈给模型。
  const retryHint = `上一次输出不合法：${firstCheck.errors.join('; ')}。请修正后重新输出。`;
  const second = await attempt(retryHint);
  const secondCheck = validate(second);
  if (secondCheck.success) return second;
  throw new Error(`模型输出校验失败（重试后仍不合法）：${secondCheck.errors.join('; ')}`);
}
