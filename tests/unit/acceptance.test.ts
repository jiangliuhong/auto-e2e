import { chmod, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
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
  loadAcceptanceRequirements,
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

  it('不再读取旧版 task-spec.json', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-legacy-spec-'));
    await mkdir(path.join(root, '.auto-e2e'), { recursive: true });
    await writeFile(path.join(root, '.auto-e2e', 'task-spec.json'), JSON.stringify({
      title: '旧用例', requirement: '不应加载', acceptanceCriteria: ['不应执行'],
    }), 'utf8');
    await expect(loadAcceptanceRequirements({ projectRoot: root })).rejects.toThrow(/未找到验收用例/);
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
  it('暂存项目内 Excel 输入并把结构化输出加入强制验收清单', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-data-driven-'));
    await mkdir(path.join(root, '.auto-e2e', 'specs'), { recursive: true });
    await mkdir(path.join(root, 'fixtures'), { recursive: true });
    await writeFile(path.join(root, 'fixtures', 'pl-forecast.xlsx'), 'fake-xlsx', 'utf8');
    await writeFile(path.join(root, '.auto-e2e', 'specs', 'pl-forecast.spec.json'), JSON.stringify({
      title: 'P&L 预测',
      requirement: '上传 Excel 模板并锁定计算',
      inputs: [{ name: 'P&L 模板', path: 'fixtures/pl-forecast.xlsx' }],
      outputs: [{
        name: '税前利润',
        location: '预测结果汇总区',
        expected: 125000.25,
        match: 'numeric',
        tolerance: 0.01,
      }],
      acceptanceCriteria: ['模板上传成功并完成锁定计算'],
    }), 'utf8');
    const fakeCli = path.join(root, 'fake-betterwright');
    await writeFile(fakeCli, `#!/bin/sh
cat > "${path.join(root, 'prompt.txt')}"
printf '%s' '{"ok":true,"answer":"{\\"summary\\":\\"全部通过\\",\\"criteria\\":[{\\"id\\":\\"AC-01\\",\\"description\\":\\"上传\\",\\"status\\":\\"passed\\",\\"actual\\":\\"模板已上传并计算\\",\\"proof\\":null},{\\"id\\":\\"AC-02\\",\\"description\\":\\"输出\\",\\"status\\":\\"passed\\",\\"actual\\":\\"页面显示 125000.25\\",\\"proof\\":null}]}","steps":3,"proof":null}'
`, 'utf8');
    await chmod(fakeCli, 0o700);
    const oldHome = process.env.BETTERWRIGHT_HOME;
    process.env.BETTERWRIGHT_HOME = path.join(root, 'betterwright-home');
    try {
      const run = await executeAcceptance({
        projectRoot: root,
        config: defaultConfig('demo'),
        betterwrightBinary: fakeCli,
      });
      expect(run.status).toBe('passed');
      expect(run.schemaVersion).toBe(1);
      if (run.schemaVersion !== 1) throw new Error('expected single run');
      expect(run.criteria).toHaveLength(2);
      expect(run.criteria[1]?.description).toContain('允许绝对误差 0.01');
      const prompt = await readFile(path.join(root, 'prompt.txt'), 'utf8');
      expect(prompt).toContain('P&L 模板');
      expect(prompt).toContain(path.join('artifacts', 'auto-e2e-inputs'));
      expect(prompt).toContain('期望=125000.25');
    } finally {
      if (oldHome === undefined) delete process.env.BETTERWRIGHT_HOME;
      else process.env.BETTERWRIGHT_HOME = oldHome;
    }
  });

  it('阻止输入文件通过路径或符号链接逃逸项目目录', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-input-escape-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-input-outside-'));
    await mkdir(path.join(root, '.auto-e2e', 'specs'), { recursive: true });
    await mkdir(path.join(root, 'fixtures'), { recursive: true });
    await writeFile(path.join(outside, 'secret.xlsx'), 'secret', 'utf8');
    await symlink(path.join(outside, 'secret.xlsx'), path.join(root, 'fixtures', 'linked.xlsx'));
    await writeFile(path.join(root, '.auto-e2e', 'specs', 'escape.spec.json'), JSON.stringify({
      title: '非法输入',
      requirement: '不应读取项目外文件',
      inputs: [{ name: '外部文件', path: 'fixtures/linked.xlsx' }],
      acceptanceCriteria: ['不执行'],
    }), 'utf8');
    await expect(executeAcceptance({
      projectRoot: root,
      config: defaultConfig('demo'),
      betterwrightBinary: path.join(root, 'unused'),
    })).rejects.toThrow(/输入文件不能位于项目目录之外/);
  });

  it('通过 BetterWright CLI 落库并可查询', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-acceptance-'));
    await mkdir(path.join(root, '.auto-e2e', 'specs'), { recursive: true });
    await writeFile(path.join(root, '.auto-e2e', 'specs', 'user-search.spec.json'), JSON.stringify({
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
    expect(run.schemaVersion).toBe(1);
    if (run.schemaVersion !== 1) throw new Error('expected single run');
    expect(run.criteria[0]?.actual).toBe('页面已显示');

    const store = new AcceptanceHistoryStore(root, config.acceptance.databasePath);
    expect((await store.list())[0]?.runId).toBe(run.runId);
    const stored = await store.get(run.runId);
    expect(stored?.schemaVersion).toBe(1);
    if (!stored || stored.schemaVersion !== 1) throw new Error('expected stored single run');
    expect(stored.criteria[0]?.status).toBe('passed');
    const snapshot = await readFile(
      path.join(root, '.auto-e2e', 'reports', 'acceptance', 'latest', 'result.json'),
      'utf8',
    );
    expect(JSON.parse(snapshot).runId).toBe(run.runId);
  });

  it('BetterWright 返回非法结果时仍保存 blocked 历史', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-blocked-'));
    await mkdir(path.join(root, '.auto-e2e', 'specs'), { recursive: true });
    await writeFile(path.join(root, '.auto-e2e', 'specs', 'user-search.spec.json'), JSON.stringify({
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

  it('逐个运行多用例套件并保存汇总报告', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-suite-'));
    const specDirectory = path.join(root, '.auto-e2e', 'specs');
    await mkdir(specDirectory, { recursive: true });
    await writeFile(path.join(specDirectory, 'search-existing.spec.json'), JSON.stringify({
      taskId: 'SEARCH-01', title: '有结果', requirement: '搜索已有记录', acceptanceCriteria: ['显示记录'],
    }), 'utf8');
    await writeFile(path.join(specDirectory, 'search-empty.spec.json'), JSON.stringify({
      taskId: 'SEARCH-02', title: '无结果', requirement: '搜索缺失记录', acceptanceCriteria: ['显示空状态'],
    }), 'utf8');
    await writeFile(path.join(specDirectory, 'ignored.json'), JSON.stringify({
      taskId: 'IGNORED', title: '忽略', requirement: '不应运行', acceptanceCriteria: ['不应执行'],
    }), 'utf8');
    const fakeCli = path.join(root, 'fake-betterwright');
    await writeFile(fakeCli, `#!/bin/sh
cat >/dev/null
printf '%s' '{"ok":true,"answer":"{\\"summary\\":\\"通过\\",\\"criteria\\":[{\\"id\\":\\"AC-01\\",\\"description\\":\\"result\\",\\"status\\":\\"passed\\",\\"actual\\":\\"页面可见\\",\\"proof\\":null}]}","steps":2,"proof":null}'
`, 'utf8');
    await chmod(fakeCli, 0o700);

    const run = await executeAcceptance({
      projectRoot: root,
      config: defaultConfig('demo'),
      betterwrightBinary: fakeCli,
      session: 'suite-session',
    });
    expect(run.schemaVersion).toBe(2);
    if (run.schemaVersion !== 2) throw new Error('expected suite run');
    expect(run.status).toBe('passed');
    expect(run.cases.map((item) => item.caseId)).toEqual(['SEARCH-02', 'SEARCH-01']);
    expect(run.cases.map((item) => item.session)).toEqual([
      'suite-session-01-search-02',
      'suite-session-02-search-01',
    ]);

    const store = new AcceptanceHistoryStore(root);
    const listed = (await store.list())[0]!;
    expect(listed.caseCount).toBe(2);
    expect(listed.passedCaseCount).toBe(2);
    expect(listed.criteriaCount).toBe(2);
    expect((await store.get(run.runId))?.schemaVersion).toBe(2);
    const snapshot = JSON.parse(await readFile(
      path.join(root, '.auto-e2e', 'reports', 'acceptance', 'latest', 'result.json'),
      'utf8',
    ));
    expect(snapshot.cases).toHaveLength(2);
  });
});
