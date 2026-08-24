import { describe, it, expect } from 'vitest';
import { MockPiClient } from '../../src/agent/mock-pi-client.js';
import { createPiClient } from '../../src/agent/pi-client-factory.js';
import { validateTestPlan } from '../../src/domain/test-plan.js';
import type { TaskSpec } from '../../src/domain/task-spec.js';
import type { ExploreResult } from '../../src/domain/explore-result.js';

const spec: TaskSpec = {
  taskId: 'TASK-1',
  title: '用户禁用',
  requirement: '管理员可禁用用户',
  acceptanceCriteria: ['展示禁用按钮', '禁用需二次确认'],
  changedFiles: ['src/users.tsx'],
  changedRoutes: ['/users'],
  riskHints: ['缓存未刷新'],
};

const exploration: ExploreResult = {
  taskId: 'TASK-1',
  pages: [
    {
      route: '/users',
      reachable: true,
      elements: [
        { description: '禁用按钮', recommendedLocator: "page.getByTestId('disable-btn')", fallbackLocators: [], stable: true, verified: true },
      ],
      observedRequests: [],
      screenshots: [],
    },
  ],
  blockers: [],
};

describe('MockPiClient', () => {
  const client = new MockPiClient();

  it('checkAuth 始终已认证', async () => {
    const s = await client.checkAuth();
    expect(s.authenticated).toBe(true);
    expect(s.provider).toBe('mock');
  });

  it('createTestPlan 每条验收标准一个正向用例 + 一个反向用例', async () => {
    const analysis = await client.analyzeRequirement({ taskSpec: spec });
    const plan = await client.createTestPlan({ taskSpec: spec, analysis, maxTestsPerTask: 10 });
    const validation = validateTestPlan(plan);
    expect(validation.success).toBe(true);
    expect(plan.testCases.length).toBe(3); // 2 正向 + 1 反向
    expect(plan.testCases.filter((t) => t.type === 'positive').length).toBe(2);
    expect(plan.testCases.some((t) => t.type === 'negative')).toBe(true);
  });

  it('createTestPlan 受 maxTestsPerTask 限制', async () => {
    const analysis = await client.analyzeRequirement({ taskSpec: spec });
    const plan = await client.createTestPlan({ taskSpec: spec, analysis, maxTestsPerTask: 1 });
    expect(plan.testCases.length).toBe(1);
  });

  it('generateTest 生成合法 TypeScript，使用推荐定位器', async () => {
    const analysis = await client.analyzeRequirement({ taskSpec: spec });
    const plan = await client.createTestPlan({ taskSpec: spec, analysis, maxTestsPerTask: 10 });
    const gen = await client.generateTest({ taskSpec: spec, testPlan: plan, exploration, preferTestId: true });
    expect(gen.code).toContain("import { expect, test } from '@playwright/test'");
    expect(gen.code).toContain('test.describe');
    expect(gen.code).toContain('TASK-1');
    expect(gen.code).toContain("getByTestId('disable-btn')");
    // 不写死密码/cookie。
    expect(gen.code).not.toMatch(/password|cookie|token/i);
  });

  it('mock 状态化探索决策确定性结束', async () => {
    const decision = await client.decideExplorationAction({
      taskId: 'TASK-1',
      route: '/users',
      acceptanceCriteria: spec.acceptanceCriteria,
      testCases: [],
      current: {
        url: 'http://localhost:3000/users',
        elements: [],
      },
      history: [],
    });
    expect(decision).toEqual({ type: 'complete', reason: 'mock 页面已完成静态探索' });
  });

  it('analyzeFailure 按关键词分类', async () => {
    const r1 = await client.analyzeFailure({ testTitle: 't', errorMessage: 'timeout 30000ms exceeded' });
    expect(r1.category).toBe('environment_failure');
    const r2 = await client.analyzeFailure({ testTitle: 't', errorMessage: '401 unauthorized' });
    expect(r2.category).toBe('auth_failure');
    const r3 = await client.analyzeFailure({ testTitle: 't', errorMessage: 'expect received unexpected' });
    expect(r3.category).toBe('product_defect');
  });
});

describe('pi-client-factory', () => {
  it('mock 配置返回 MockPiClient', () => {
    const c = createPiClient({ agent: { implementation: 'mock' } } as never);
    expect(c).toBeInstanceOf(MockPiClient);
  });
});
