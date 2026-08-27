import { chmod, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config/defaults.js';
import { executeAcceptance } from '../../src/acceptance/acceptance-runner.js';
import { parseAcceptanceAnswer } from '../../src/acceptance/betterwright-cli.js';
import { AcceptanceHistoryStore } from '../../src/acceptance/history-store.js';
import {
  extractAcceptanceCriteria,
  loadAcceptanceRequirement,
} from '../../src/acceptance/requirement-loader.js';

describe('acceptance requirement loader', () => {
  it('从 Markdown 验收标准列表生成稳定编号', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-requirement-'));
    await writeFile(
      path.join(root, 'requirement.md'),
      '# 用户查询\n\n## 验收标准\n\n- 能按名称查询\n- 空结果显示提示\n',
      'utf8',
    );
    const loaded = await loadAcceptanceRequirement({
      projectRoot: root,
      requirement: 'requirement.md',
    });
    expect(loaded.source.title).toBe('用户查询');
    expect(loaded.criteria).toEqual([
      { id: 'AC-01', description: '能按名称查询' },
      { id: 'AC-02', description: '空结果显示提示' },
    ]);
  });

  it('识别 OpenSpec Scenario', () => {
    expect(extractAcceptanceCriteria(
      '## Requirement: Search\n### Scenario: Search succeeds\n- **WHEN** input\n- **THEN** result',
    )).toEqual(['Search succeeds']);
  });
});

describe('BetterWright acceptance output', () => {
  it('拒绝遗漏验收标准的最终答案', () => {
    expect(() => parseAcceptanceAnswer(
      JSON.stringify({
        summary: 'done',
        criteria: [{
          id: 'AC-01', description: 'a', status: 'passed', actual: 'visible', proof: null,
        }],
      }),
      [{ id: 'AC-01', description: 'a' }, { id: 'AC-02', description: 'b' }],
    )).toThrow(/未完整覆盖/);
  });
});

describe('acceptance run and history', () => {
  it('通过 BetterWright CLI 落库并可查询', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-acceptance-'));
    await mkdir(path.join(root, '.auto-e2e'), { recursive: true });
    await writeFile(path.join(root, '.auto-e2e', 'task-spec.json'), JSON.stringify({
      taskId: 'TASK-1',
      title: '用户查询',
      requirement: '用户可以查询',
      acceptanceCriteria: ['显示查询结果'],
    }), 'utf8');
    const fakeCli = path.join(root, 'fake-betterwright');
    await writeFile(fakeCli, `#!/bin/sh
read_prompt=$(cat)
printf '%s' '{"ok":true,"answer":"{\\"summary\\":\\"全部通过\\",\\"criteria\\":[{\\"id\\":\\"AC-01\\",\\"description\\":\\"显示查询结果\\",\\"status\\":\\"passed\\",\\"actual\\":\\"页面已显示\\",\\"proof\\":null}]}","steps":2,"proof":null}'
`, 'utf8');
    await chmod(fakeCli, 0o700);
    const config = defaultConfig();
    config.project.name = 'demo';
    const run = await executeAcceptance({
      projectRoot: root,
      config,
      betterwrightBinary: fakeCli,
      model: 'test-model',
    });
    expect(run.status).toBe('passed');
    expect(run.criteria[0]?.actual).toBe('页面已显示');

    const store = new AcceptanceHistoryStore(root, config.acceptance.databasePath);
    expect((await store.list())[0]?.runId).toBe(run.runId);
    expect((await store.get(run.runId))?.criteria[0]?.status).toBe('passed');
    const snapshot = await readFile(
      path.join(root, '.auto-e2e', 'reports', 'acceptance', 'latest', 'result.json'),
      'utf8',
    );
    expect(JSON.parse(snapshot).runId).toBe(run.runId);
  });

  it('BetterWright 返回非法结果时仍保存 blocked 历史', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-blocked-'));
    await mkdir(path.join(root, '.auto-e2e'), { recursive: true });
    await writeFile(path.join(root, '.auto-e2e', 'task-spec.json'), JSON.stringify({
      title: '用户查询',
      requirement: '用户可以查询',
      acceptanceCriteria: ['显示查询结果'],
    }), 'utf8');
    const fakeCli = path.join(root, 'fake-betterwright');
    await writeFile(fakeCli, `#!/bin/sh
cat >/dev/null
printf '%s' '{"ok":true,"answer":"not-json","steps":1,"proof":null}'
`, 'utf8');
    await chmod(fakeCli, 0o700);
    const config = defaultConfig('demo');
    const run = await executeAcceptance({ projectRoot: root, config, betterwrightBinary: fakeCli });
    expect(run.status).toBe('blocked');
    expect(run.error).toContain('不是合法验收 JSON');
    expect((await new AcceptanceHistoryStore(root).get(run.runId))?.status).toBe('blocked');
  });
});
