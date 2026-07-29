import { describe, it, expect } from 'vitest';
import { describeTaskSpec } from '../../src/agent/spec-describer.js';

describe('describeTaskSpec', () => {
  const spec = describeTaskSpec();

  it('基本元信息正确', () => {
    expect(spec.file).toBe('task-spec.json');
    expect(spec.format).toBe('json');
    // 与 verify / generate 的 --spec 默认值保持一致。
    expect(spec.defaultPath).toBe('.auto-e2e/task-spec.json');
  });

  it('字段数量与 TaskSpecSchema 一致（10 个）', () => {
    expect(spec.fields).toHaveLength(10);
  });

  it('5 个必填字段 required=true', () => {
    const required = spec.fields.filter((f) => f.required).map((f) => f.name);
    expect(required.sort()).toEqual(
      ['taskId', 'title', 'requirement', 'acceptanceCriteria', 'changedFiles'].sort(),
    );
  });

  it('5 个可选字段 required=false', () => {
    const optional = spec.fields.filter((f) => !f.required).map((f) => f.name);
    expect(optional.sort()).toEqual(
      ['changedRoutes', 'changedApis', 'riskHints', 'startCommand', 'baseUrl'].sort(),
    );
  });

  it('acceptanceCriteria / changedFiles 类型为 string[]', () => {
    const find = (name: string) => spec.fields.find((f) => f.name === name);
    expect(find('acceptanceCriteria')?.type).toBe('string[]');
    expect(find('changedFiles')?.type).toBe('string[]');
    expect(find('changedRoutes')?.type).toBe('string[]');
  });

  it('taskId / baseUrl 类型为 string', () => {
    const find = (name: string) => spec.fields.find((f) => f.name === name);
    expect(find('taskId')?.type).toBe('string');
    expect(find('baseUrl')?.type).toBe('string');
  });

  it('每个字段都有非空 description', () => {
    for (const f of spec.fields) {
      expect(f.description.length).toBeGreaterThan(0);
    }
  });
});
