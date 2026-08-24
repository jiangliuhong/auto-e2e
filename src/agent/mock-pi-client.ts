/**
 * MockPiClient：不依赖真实 ChatGPT OAuth，根据 task-spec 确定性产出结构化结果。
 *
 * 目的：让整条 verify 流水线在无外部账号时也能跑通与测试。
 * 行为：
 * - checkAuth 始终返回已认证（mock 模式）。
 * - createTestPlan：每条验收标准生成一个正向用例 + 一个反向用例（若有 riskHints）。
 * - generateTest：基于 exploration 推荐定位器生成最简 Playwright 测试。
 * - analyzeFailure：基于关键词启发式分类。
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
import type {
  ExplorationDecision,
  ExplorationDecisionInput,
} from '../domain/exploration-action.js';
import type { TestPlan, TestCase } from '../domain/test-plan.js';
import type { FailureEntry } from '../domain/test-result.js';
import type { TaskSpec } from '../domain/task-spec.js';

export class MockPiClient implements PiClient {
  private calls = 0;
  async checkAuth(): Promise<AuthStatus> {
    return { authenticated: true, provider: 'mock', message: 'mock 模式，无需 OAuth' };
  }

  async login(): Promise<AuthStatus> {
    return this.checkAuth();
  }

  async analyzeRequirement(input: RequirementAnalysisInput): Promise<RequirementAnalysis> {
    this.calls++;
    const spec = input.taskSpec;
    return {
      understanding: spec.requirement,
      scenarios: spec.acceptanceCriteria.map((c) => `覆盖：${c}`),
      identifiedRisks: spec.riskHints ?? [],
    };
  }

  async createTestPlan(input: TestPlanInput): Promise<TestPlan> {
    this.calls++;
    const spec = input.taskSpec;
    const max = input.maxTestsPerTask;
    const cases: TestCase[] = [];

    let idx = 1;
    for (const criteria of spec.acceptanceCriteria) {
      if (cases.length >= max) break;
      cases.push({
        id: `TC-${String(idx).padStart(3, '0')}`,
        title: `正向：${criteria}`,
        priority: 'P0',
        type: 'positive',
        acceptanceCriteria: [criteria],
        preconditions: ['目标用户已登录系统'],
        steps: this.deriveSteps(spec, criteria),
        expected: [criteria],
      });
      idx++;
    }

    // 有风险时追加一个反向用例。
    if ((spec.riskHints?.length ?? 0) > 0 && cases.length < max) {
      cases.push({
        id: `TC-${String(idx).padStart(3, '0')}`,
        title: '反向：验证异常输入或边界',
        priority: 'P1',
        type: 'negative',
        acceptanceCriteria: spec.acceptanceCriteria.slice(0, 1),
        preconditions: ['系统处于可测状态'],
        steps: ['执行异常操作路径', '观察系统响应'],
        expected: ['系统应正确处理异常，不产生错误状态'],
      });
    }

    return {
      taskId: spec.taskId,
      scope: 'incremental',
      testCases: cases,
      uncoveredCriteria: [],
      risks: spec.riskHints ?? [],
    };
  }

  async generateTest(input: GenerateTestInput): Promise<GeneratedTest> {
    this.calls++;
    const { taskSpec, testPlan, exploration, preferTestId } = input;
    const code = renderTestFile(taskSpec, testPlan, exploration, preferTestId);
    return {
      taskId: taskSpec.taskId,
      code,
      notes: ['mock 生成：基于 exploration 推荐定位器', preferTestId ? '优先使用 data-testid' : '按推荐定位器生成'],
    };
  }

  async decideExplorationAction(
    _input: ExplorationDecisionInput,
  ): Promise<ExplorationDecision> {
    this.calls++;
    return { type: 'complete', reason: 'mock 页面已完成静态探索' };
  }

  async analyzeFailure(input: FailureAnalysisInput): Promise<FailureEntry> {
    this.calls++;
    const { category, confidence } = classifyFailure(input);
    return {
      test: input.testTitle,
      category,
      message: input.errorMessage,
      expected: input.expected,
      actual: input.actual,
      confidence,
      artifacts: input.artifacts,
    };
  }

  getTelemetry(): PiTelemetrySnapshot {
    return {
      calls: this.calls, retries: 0, durationMs: 0, tokenUsage: null,
      promptHashes: {}, knowledgeHashes: {},
    };
  }

  private deriveSteps(spec: TaskSpec, criteria: string): string[] {
    const route = spec.changedRoutes?.[0] ?? '/';
    return [`打开页面 ${route}`, `执行：${criteria}`, '观察结果'];
  }
}

/** 启发式失败分类。 */
function classifyFailure(input: FailureAnalysisInput): { category: FailureEntry['category']; confidence: number } {
  const msg = `${input.errorMessage} ${input.testTitle}`.toLowerCase();
  if (/(timeout|navigation timeout|net::err|econnrefused|503|502|启动)/.test(msg)) {
    return { category: 'environment_failure', confidence: 0.8 };
  }
  if (/(login|auth|401|403|unauthorized|forbidden|权限)/.test(msg)) {
    return { category: 'auth_failure', confidence: 0.85 };
  }
  if (/(locator|selector|strict mode|not found|testid)/.test(msg)) {
    return { category: 'test_defect', confidence: 0.7 };
  }
  if (/(browser|target closed|crash)/.test(msg)) {
    return { category: 'browser_failure', confidence: 0.75 };
  }
  // 默认倾向业务缺陷（断言失败等）。
  return { category: 'product_defect', confidence: 0.6 };
}

/** 生成 Playwright 测试文件内容。 */
function renderTestFile(
  spec: TaskSpec,
  plan: TestPlan,
  exploration: GenerateTestInput['exploration'],
  preferTestId: boolean,
): string {
  const route = spec.changedRoutes?.[0] ?? '/';
  const lines: string[] = [];
  lines.push(`import { expect, test } from '@playwright/test';`);
  lines.push('');
  lines.push(`test.describe('${spec.taskId} ${escapeQuote(spec.title)}', () => {`);

  for (const tc of plan.testCases) {
    lines.push(`  test('${escapeQuote(tc.title)}', async ({ page }) => {`);
    lines.push(`    await page.goto('${route}');`);
    // 选取该用例相关页面元素的最优定位器。
    const locator = pickLocator(exploration, preferTestId);
    if (locator) {
      lines.push(`    const target = ${locator};`);
      lines.push(`    await expect(target).toBeVisible();`);
    }
    for (const expected of tc.expected) {
      lines.push(`    // 预期：${expected}`);
    }
    lines.push(`  });`);
    lines.push('');
  }

  lines.push(`});`);
  lines.push('');
  return lines.join('\n');
}

function pickLocator(
  exploration: GenerateTestInput['exploration'],
  preferTestId: boolean,
): string | undefined {
  const firstPage = exploration.pages[0];
  if (!firstPage) return undefined;
  // 优先 stable 元素；preferTestId 时优先 recommendedLocator 含 testid 的。
  const elements = firstPage.elements.filter((e) => e.stable);
  const pool = elements.length > 0 ? elements : firstPage.elements;
  if (pool.length === 0) return undefined;
  const candidate =
    (preferTestId ? pool.find((e) => /getByTestId/.test(e.recommendedLocator)) : undefined) ??
    pool[0]!;
  return candidate.recommendedLocator;
}

function escapeQuote(s: string): string {
  return s.replace(/'/g, "\\'");
}
