import { describe, it, expect } from 'vitest';
import { validateTaskSpec } from '../../src/domain/task-spec.js';

const validSpec = {
  taskId: 'TASK-1',
  title: 't',
  requirement: 'r',
  acceptanceCriteria: ['a', 'b'],
  changedFiles: ['f.ts'],
};

describe('validateTaskSpec', () => {
  it('合法 task-spec 通过', () => {
    const r = validateTaskSpec(validSpec);
    expect(r.success).toBe(true);
    expect(r.isEmptyCriteria).toBe(false);
    expect(r.spec?.taskId).toBe('TASK-1');
  });

  it('缺少必填字段时失败', () => {
    const r = validateTaskSpec({ taskId: 'TASK-1' });
    expect(r.success).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('acceptanceCriteria 为空时 success=true 但 isEmptyCriteria=true', () => {
    const r = validateTaskSpec({ ...validSpec, acceptanceCriteria: [] });
    // 注意：空数组仍通过 zod（非 min(1) 约束的数组），但调用方需要退出码 4。
    expect(r.success).toBe(true);
    expect(r.isEmptyCriteria).toBe(true);
  });

  it('baseUrl 非合法 URL 时失败', () => {
    const r = validateTaskSpec({ ...validSpec, baseUrl: 'not-a-url' });
    expect(r.success).toBe(false);
  });
});
