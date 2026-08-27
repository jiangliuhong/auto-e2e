import { describe, expect, it } from 'vitest';
import { validateTaskSpec } from '../../src/domain/task-spec.js';

describe('task spec', () => {
  it('接受验收运行器的最小需求契约', () => {
    expect(validateTaskSpec({
      title: '用户查询',
      requirement: '用户可以查询',
      acceptanceCriteria: ['显示结果'],
    }).success).toBe(true);
  });

  it('拒绝空验收标准和旧 Playwright 字段', () => {
    expect(validateTaskSpec({ title: 'x', requirement: 'y', acceptanceCriteria: [] }).success).toBe(false);
    expect(validateTaskSpec({
      title: 'x', requirement: 'y', acceptanceCriteria: ['z'], changedFiles: [],
    }).success).toBe(false);
  });
});
