import { describe, expect, it } from 'vitest';
import { isAcceptanceSpecFileName, validateTaskSpec } from '../../src/domain/task-spec.js';

describe('task spec', () => {
  it('接受验收运行器的最小需求契约', () => {
    expect(validateTaskSpec({
      title: '用户查询',
      requirement: '用户可以查询',
      acceptanceCriteria: ['显示结果'],
    }).success).toBe(true);
  });

  it('接受项目内文件输入和结构化页面输出', () => {
    const result = validateTaskSpec({
      title: 'P&L 预测',
      requirement: '上传模板并锁定计算',
      inputs: [{ name: '预测模板', path: 'fixtures/pl-forecast.xlsx' }],
      outputs: [{
        name: '税前利润',
        location: '预测结果汇总区',
        expected: 125000.25,
        match: 'numeric',
        tolerance: 0.01,
      }],
      acceptanceCriteria: ['模板上传成功并完成锁定计算'],
    });
    expect(result.success).toBe(true);
  });

  it('拒绝不匹配的输出比较类型', () => {
    expect(validateTaskSpec({
      title: 'x',
      requirement: 'y',
      acceptanceCriteria: ['z'],
      outputs: [{ name: '利润', location: '结果区', expected: '100', match: 'numeric' }],
    }).success).toBe(false);
  });

  it('拒绝空验收标准和旧 Playwright 字段', () => {
    expect(validateTaskSpec({ title: 'x', requirement: 'y', acceptanceCriteria: [] }).success).toBe(false);
    expect(validateTaskSpec({
      title: 'x', requirement: 'y', acceptanceCriteria: ['z'], changedFiles: [],
    }).success).toBe(false);
  });

  it('只识别约定的验收用例文件名', () => {
    expect(isAcceptanceSpecFileName('order-search.spec.json')).toBe(true);
    expect(isAcceptanceSpecFileName('ORDER_01.spec.json')).toBe(true);
    expect(isAcceptanceSpecFileName('task-spec.json')).toBe(false);
    expect(isAcceptanceSpecFileName('../order.spec.json')).toBe(false);
  });
});
