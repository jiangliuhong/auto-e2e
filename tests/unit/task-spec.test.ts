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

  it('接受自包含 Spec Bundle v2', () => {
    const result = validateTaskSpec({
      schemaVersion: 2,
      taskId: 'PL-FORECAST-01',
      title: 'P&L 预测',
      requirement: '上传预测模板并核对结果',
      files: [
        { id: 'forecast-input', role: 'input', path: 'inputs/forecast.xlsx' },
        { id: 'expected-result', role: 'expected', path: 'expected/result.xlsx' },
      ],
      steps: [{
        id: 'STEP-01', instruction: '上传预测模板并完成试算', uses: ['forecast-input'], expected: '试算完成',
      }],
      results: [{
        id: 'RESULT-01', name: '锁定结果', actual: '页面锁定结果表格',
        expected: { file: 'expected-result', sheet: '锁定结果' }, match: 'table',
      }],
    });
    expect(result.success).toBe(true);
  });

  it('拒绝 Bundle 中不存在、角色错误或未使用的文件引用', () => {
    const result = validateTaskSpec({
      schemaVersion: 2,
      taskId: 'INVALID-01',
      title: '非法引用',
      requirement: '不执行',
      files: [
        { id: 'expected', role: 'expected', path: 'expected/result.xlsx' },
        { id: 'unused', role: 'input', path: 'inputs/unused.xlsx' },
      ],
      steps: [{ id: 'STEP-01', instruction: '上传文件', uses: ['expected'], expected: '完成' }],
      results: [{ id: 'RESULT-01', name: '结果', actual: '结果区', expected: { file: 'missing' }, match: 'table' }],
    });
    expect(result.success).toBe(false);
    expect(result.errors.join('\n')).toMatch(/步骤不能使用 expected|不存在的文件|未被任何步骤或结果使用/);
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
    expect(isAcceptanceSpecFileName('spec.json')).toBe(true);
    expect(isAcceptanceSpecFileName('task-spec.json')).toBe(false);
    expect(isAcceptanceSpecFileName('../order.spec.json')).toBe(false);
  });
});
