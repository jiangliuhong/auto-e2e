import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRunId } from '../../src/runtime/run-id.js';
import { PromptLoader } from '../../src/agent/prompt-loader.js';
import { KnowledgeLoader } from '../../src/agent/knowledge-loader.js';
import { writeEvaluationMetrics } from '../../src/evaluation/metrics-writer.js';
import { EvaluationMetricsSchema } from '../../src/domain/evaluation-metrics.js';
import { ModelTestPlanSchema } from '../../src/agent/sdk-pi-client.js';

describe('v0.2 runtime contracts', () => {
  it('creates sortable run ids with UUID suffix', () => {
    expect(createRunId(new Date('2026-07-29T12:41:22.123Z'), 'a1b2c3d4-0000-0000-0000-000000000000'))
      .toBe('20260729T124122123Z-a1b2c3d4');
  });

  it('loads a project prompt override and validates variables', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-prompt-'));
    const dir = path.join(root, '.auto-e2e', 'prompts');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'analyze-requirement.md'), 'Input={{INPUT_JSON}} Knowledge={{KNOWLEDGE}}');
    const rendered = await new PromptLoader(root).render('analyze-requirement', {
      INPUT_JSON: { b: 2, a: 1 },
      KNOWLEDGE: 'none',
    });
    expect(rendered.source).toBe('project');
    expect(rendered.content).toContain('"a": 1');
    await expect(new PromptLoader(root).render('analyze-requirement', {
      INPUT_JSON: {},
    })).rejects.toThrow(/缺少变量/);
  });

  it('selects knowledge deterministically and obeys limits', async () => {
    const selected = await new KnowledgeLoader(process.cwd(), {
      enabled: true, maxFiles: 1, maxCharacters: 20,
    }).select({
      taskId: 'T', title: '登录分页', requirement: '验证 login pagination',
      acceptanceCriteria: ['用户登录'], changedFiles: [], changedRoutes: ['/login'],
    });
    expect(Object.keys(selected.hashes)).toEqual(['login']);
    expect(selected.content.length).toBeGreaterThan(0);
  });

  it('normalizes a scalar expected value at the model adapter boundary', () => {
    const parsed = ModelTestPlanSchema.parse({
      taskId: 'T-1',
      scope: 'incremental',
      testCases: [{
        id: 'TC-001',
        title: '提交表单',
        priority: 'P0',
        type: 'positive',
        acceptanceCriteria: ['提交成功'],
        steps: ['点击提交'],
        expected: '显示成功提示',
      }],
      uncoveredCriteria: [],
      risks: [],
    });

    expect(parsed.testCases[0]?.expected).toEqual(['显示成功提示']);
  });

  it('writes versioned evaluation metrics', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ae2e-metrics-'));
    const metrics = {
      schemaVersion: 1 as const,
      runId: 'run-1', taskId: 'T', autoE2EVersion: '0.2.0', mode: 'full' as const,
      requirementCount: null, generatedTestCount: null, coveredRequirementCount: null,
      passedTestCount: 1, failedTestCount: 0, skippedTestCount: 0,
      totalDurationMs: 10, explorerDurationMs: null, llmCallCount: 0,
      llmRetryCount: 0, tokenUsage: null,
      agent: { implementation: 'mock', provider: 'mock', model: 'default' },
      browser: { implementation: 'mock', playwrightVersion: '1.48.0' },
      promptHashes: {}, knowledgeHashes: {},
    };
    const output = await writeEvaluationMetrics(root, metrics);
    const parsed = EvaluationMetricsSchema.parse(JSON.parse(await fs.readFile(output, 'utf8')));
    expect(parsed.tokenUsage).toBeNull();
  });
});
