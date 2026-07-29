import { describe, it, expect } from 'vitest';
import { generateTestFile } from '../../src/playwright/test-generator.js';
import { MockPiClient } from '../../src/agent/mock-pi-client.js';
import { AutoE2EError } from '../../src/runtime/exit-codes.js';
import type { TaskSpec } from '../../src/domain/task-spec.js';
import type { TestPlan } from '../../src/domain/test-plan.js';
import type { ExploreResult } from '../../src/domain/explore-result.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const spec: TaskSpec = {
  taskId: 'TASK-GEN-1',
  title: '禁用用户',
  requirement: '管理员可禁用用户',
  acceptanceCriteria: ['展示禁用按钮'],
  changedFiles: ['src/users.tsx'],
  changedRoutes: ['/users'],
};

const plan: TestPlan = {
  taskId: 'TASK-GEN-1',
  scope: 'incremental',
  testCases: [
    {
      id: 'TC-001',
      title: '正向：展示禁用按钮',
      priority: 'P0',
      type: 'positive',
      acceptanceCriteria: ['展示禁用按钮'],
      preconditions: ['已登录'],
      steps: ['打开页面'],
      expected: ['展示禁用按钮'],
    },
  ],
  uncoveredCriteria: [],
  risks: [],
};

const exploration: ExploreResult = {
  taskId: 'TASK-GEN-1',
  pages: [
    {
      route: '/users',
      reachable: true,
      elements: [
        { description: '禁用按钮', recommendedLocator: "page.getByTestId('disable-btn')", fallbackLocators: [], stable: true },
      ],
      observedRequests: [],
      screenshots: [],
    },
  ],
  blockers: [],
};

async function mkTempProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-gen-'));
  return dir;
}

describe('test-generator', () => {
  it('生成合法 TS 并写入 spec.ts 与 meta.json', async () => {
    const projectRoot = await mkTempProject();
    const files = new Set<string>();
    const r = await generateTestFile({
      projectRoot,
      generatedDirectory: '.auto-e2e/generated',
      client: new MockPiClient(),
      taskSpec: spec,
      testPlan: plan,
      exploration,
      preferTestId: true,
      overwrite: true,
      validateTs: async () => ({ ok: true }),
      // 注入写文件以追踪，但这里用真实 fs 也行；用真实 fs 验证落盘。
    });
    const content = await fs.readFile(r.specPath, 'utf8');
    expect(content).toContain("import { expect, test } from '@playwright/test'");
    expect(content).toContain('TASK-GEN-1');
    // V-6.1：有定位器时必须生成真实 expect 断言，而非仅注释。
    expect(content).toContain('await expect');
    expect(content).toContain("page.getByTestId('disable-btn')");
    const meta = JSON.parse(await fs.readFile(r.metaPath, 'utf8'));
    expect(meta.taskId).toBe('TASK-GEN-1');
    void files;
  });

  it('TS 校验失败抛 GenerationFailed(3)', async () => {
    const projectRoot = await mkTempProject();
    await expect(
      generateTestFile({
        projectRoot,
        generatedDirectory: '.auto-e2e/generated',
        client: new MockPiClient(),
        taskSpec: spec,
        testPlan: plan,
        exploration,
        preferTestId: true,
        overwrite: true,
        validateTs: async () => ({ ok: false, error: 'syntax error' }),
      }),
    ).rejects.toMatchObject({ exitCode: 3 });
  });

  it('包含疑似敏感信息时拒绝写入并抛 3', async () => {
    const projectRoot = await mkTempProject();
    // 自定义 client 返回带 password 的代码。
    const evilClient = {
      async generateTest() {
        return { taskId: 'TASK-GEN-1', code: "const password = 'secret';", notes: [] };
      },
    };
    await expect(
      generateTestFile({
        projectRoot,
        generatedDirectory: '.auto-e2e/generated',
        client: evilClient as never,
        taskSpec: spec,
        testPlan: plan,
        exploration,
        preferTestId: true,
        overwrite: true,
        validateTs: async () => ({ ok: true }),
      }),
    ).rejects.toBeInstanceOf(AutoE2EError);
  });
});
