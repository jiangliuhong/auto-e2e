import { chmod, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config/defaults.js';
import { executeAcceptance } from '../../src/acceptance/acceptance-runner.js';
import {
  parseAcceptanceAnswer,
  parseBundleAcceptanceAnswer,
  preserveProof,
} from '../../src/acceptance/betterwright-cli.js';
import { AcceptanceHistoryStore } from '../../src/acceptance/history-store.js';
import {
  loadAcceptanceRequirements,
} from '../../src/acceptance/requirement-loader.js';

describe('acceptance requirement loader', () => {
  it('递归发现 Spec Bundle 并以 bundle 目录为文件边界', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-bundle-loader-'));
    const bundle = path.join(root, '.auto-e2e', 'specs', 'pl', 'forecast-lock');
    await mkdir(path.join(bundle, 'inputs'), { recursive: true });
    await mkdir(path.join(bundle, 'expected'), { recursive: true });
    await writeFile(path.join(bundle, 'inputs', 'forecast.xlsx'), 'input', 'utf8');
    await writeFile(path.join(bundle, 'expected', 'result.xlsx'), 'expected', 'utf8');
    await writeFile(path.join(bundle, 'spec.json'), JSON.stringify({
      schemaVersion: 2,
      taskId: 'PL-FORECAST-01',
      title: 'P&L 预测',
      requirement: '上传并核对结果',
      files: [
        { id: 'input', role: 'input', path: 'inputs/forecast.xlsx' },
        { id: 'expected', role: 'expected', path: 'expected/result.xlsx' },
      ],
      steps: [{ id: 'STEP-01', instruction: '上传并试算', uses: ['input'], expected: '试算完成' }],
      results: [{ id: 'RESULT-01', name: '结果', actual: '结果表格', expected: { file: 'expected' }, match: 'table' }],
    }), 'utf8');

    const loaded = await loadAcceptanceRequirements({ projectRoot: root });
    expect(loaded.requirements).toHaveLength(1);
    expect(loaded.requirements[0]?.caseId).toBe('PL-FORECAST-01');
    expect(loaded.requirements[0]?.source.reference).toBe('.auto-e2e/specs/pl/forecast-lock/spec.json');
    expect(loaded.requirements[0]?.source.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(loaded.requirements[0]?.criteria.map((item) => item.description)).toEqual([
      expect.stringContaining('步骤 STEP-01'),
      expect.stringContaining('结果 RESULT-01'),
    ]);
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

  it('拒绝乱序或跳过后继续执行的 Bundle 步骤', () => {
    const steps = [
      { id: 'STEP-01', instruction: '第一步', expected: '完成一' },
      { id: 'STEP-02', instruction: '第二步', expected: '完成二' },
    ];
    const results = [{ id: 'RESULT-01', name: '结果', actual: '页面', expected: 'ok', match: 'equals' as const }];
    expect(() => parseBundleAcceptanceAnswer(JSON.stringify({
      summary: '非法',
      steps: [
        { id: 'STEP-02', status: 'passed', actual: '二', proof: null, error: null },
        { id: 'STEP-01', status: 'passed', actual: '一', proof: null, error: null },
      ],
      results: [{ id: 'RESULT-01', status: 'observed', actual: 'ok', proof: null, error: null }],
    }), steps, results)).toThrow(/未按规格完整有序覆盖/);
  });

  it('拒绝无前置失败的 skipped 步骤', () => {
    const steps = [
      { id: 'STEP-01', instruction: '第一步', expected: '完成一' },
      { id: 'STEP-02', instruction: '第二步', expected: '完成二' },
    ];
    const results = [{ id: 'RESULT-01', name: '结果', actual: '页面', expected: 'ok', match: 'equals' as const }];
    expect(() => parseBundleAcceptanceAnswer(JSON.stringify({
      summary: '非法',
      steps: [
        { id: 'STEP-01', status: 'skipped', actual: '跳过', proof: null, error: null },
        { id: 'STEP-02', status: 'passed', actual: '完成', proof: null, error: null },
      ],
      results: [{ id: 'RESULT-01', status: 'observed', actual: 'ok', proof: null, error: null }],
    }), steps, results)).toThrow(/不能在前置步骤失败或阻塞前跳过/);
  });

  it('业务步骤失败后强制所有结果为 blocked', () => {
    const steps = [{ id: 'STEP-01', instruction: '第一步', expected: '完成一' }];
    const results = [{ id: 'RESULT-01', name: '结果', actual: '页面', expected: 'ok', match: 'equals' as const }];
    expect(() => parseBundleAcceptanceAnswer(JSON.stringify({
      summary: '失败',
      steps: [{ id: 'STEP-01', status: 'failed', actual: '失败', proof: null, error: '失败' }],
      results: [{ id: 'RESULT-01', status: 'observed', actual: 'ok', proof: null, error: null }],
    }), steps, results)).toThrow(/必须为 blocked/);
  });

  it('Proof 只允许来自授权 artifact 目录且必须是图片', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-proof-'));
    const allowed = path.join(root, 'allowed');
    const output = path.join(root, 'output');
    await mkdir(allowed, { recursive: true });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    await writeFile(path.join(allowed, 'proof.bin'), png);
    await writeFile(path.join(root, 'secret.png'), png);
    await writeFile(path.join(allowed, 'not-image.png'), 'secret', 'utf8');

    expect(await preserveProof(path.join(allowed, 'proof.bin'), output, 'proof.png', [allowed], root))
      .toBe(path.join(output, 'proof.png'));
    expect(await preserveProof(path.join(root, 'secret.png'), output, 'secret.png', [allowed], root)).toBeNull();
    expect(await preserveProof(path.join(allowed, 'not-image.png'), output, 'text.png', [allowed], root)).toBeNull();
  });
});

describe('acceptance run and history', () => {
  it('由运行器确定性复算 Bundle 的 numeric 结果', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-bundle-numeric-'));
    const bundle = path.join(root, '.auto-e2e', 'specs', 'numeric');
    await mkdir(bundle, { recursive: true });
    await writeFile(path.join(bundle, 'spec.json'), JSON.stringify({
      schemaVersion: 2,
      taskId: 'NUMERIC-01',
      title: '数值结果',
      requirement: '检查数值',
      steps: [{ id: 'STEP-01', instruction: '打开结果页', expected: '结果可见' }],
      results: [{
        id: 'RESULT-01', name: '利润', actual: '利润字段', expected: 100,
        match: 'numeric', options: { numericTolerance: 0.1 },
      }],
    }), 'utf8');
    const fakeCli = path.join(root, 'fake-betterwright');
    await writeFile(fakeCli, `#!/bin/sh
cat >/dev/null
printf '%s' '{"ok":true,"answer":"{\\"summary\\":\\"完成\\",\\"steps\\":[{\\"id\\":\\"STEP-01\\",\\"status\\":\\"passed\\",\\"actual\\":\\"结果可见\\",\\"proof\\":null,\\"error\\":null}],\\"results\\":[{\\"id\\":\\"RESULT-01\\",\\"status\\":\\"observed\\",\\"actual\\":100.05,\\"proof\\":null,\\"error\\":null}]}","steps":1,"proof":null}'
`, 'utf8');
    await chmod(fakeCli, 0o700);
    const run = await executeAcceptance({ projectRoot: root, config: defaultConfig('demo'), betterwrightBinary: fakeCli });
    expect(run.status).toBe('passed');
    expect(run.resultAssertions?.[0]).toEqual(expect.objectContaining({
      status: 'passed', actual: 100.05, difference: expect.closeTo(0.05),
    }));
  });

  it('结构化步骤和结果不会继承任务级 Proof', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-bundle-proof-'));
    const bundle = path.join(root, '.auto-e2e', 'specs', 'proof');
    const betterWrightHome = path.join(root, 'betterwright-home');
    const proof = path.join(betterWrightHome, 'artifacts', 'overall.png');
    await mkdir(bundle, { recursive: true });
    await mkdir(path.dirname(proof), { recursive: true });
    await writeFile(proof, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]));
    await writeFile(path.join(bundle, 'spec.json'), JSON.stringify({
      schemaVersion: 2,
      taskId: 'PROOF-01',
      title: 'Proof 层级',
      requirement: '区分整体与局部证据',
      steps: [{ id: 'STEP-01', instruction: '打开结果页', expected: '结果可见' }],
      results: [{ id: 'RESULT-01', name: '结果', actual: '页面字段', expected: 'ok', match: 'equals' }],
    }), 'utf8');
    const answer = JSON.stringify({
      summary: '完成',
      steps: [{ id: 'STEP-01', status: 'passed', actual: '可见', proof: null, error: null }],
      results: [{ id: 'RESULT-01', status: 'observed', actual: 'ok', proof: null, error: null }],
    });
    const envelope = JSON.stringify({ ok: true, answer, steps: 1, proof });
    const fakeCli = path.join(root, 'fake-betterwright');
    await writeFile(fakeCli, `#!/bin/sh
cat >/dev/null
printf '%s' '${envelope}'
`, 'utf8');
    await chmod(fakeCli, 0o700);
    const previousHome = process.env.BETTERWRIGHT_HOME;
    process.env.BETTERWRIGHT_HOME = betterWrightHome;
    try {
      const run = await executeAcceptance({ projectRoot: root, config: defaultConfig('demo'), betterwrightBinary: fakeCli });
      expect(run.proof).toContain('proof.png');
      expect(run.workflowSteps?.[0]?.proof).toBeNull();
      expect(run.resultAssertions?.[0]?.proof).toBeNull();
    } finally {
      if (previousHome === undefined) delete process.env.BETTERWRIGHT_HOME;
      else process.env.BETTERWRIGHT_HOME = previousHome;
    }
  });

  it('暂存 Bundle 的 input 和 expected 文件并生成业务步骤 Prompt', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-bundle-run-'));
    const bundle = path.join(root, '.auto-e2e', 'specs', 'pl-forecast');
    await mkdir(path.join(bundle, 'inputs'), { recursive: true });
    await mkdir(path.join(bundle, 'expected'), { recursive: true });
    await writeFile(path.join(bundle, 'inputs', 'forecast.xlsx'), 'input', 'utf8');
    await writeFile(path.join(bundle, 'expected', 'result.xlsx'), 'expected', 'utf8');
    await writeFile(path.join(bundle, 'spec.json'), JSON.stringify({
      schemaVersion: 2,
      taskId: 'PL-FORECAST-01',
      title: 'P&L 预测',
      requirement: '完成试算与锁定',
      files: [
        { id: 'forecast-input', role: 'input', path: 'inputs/forecast.xlsx' },
        { id: 'expected-result', role: 'expected', path: 'expected/result.xlsx' },
      ],
      steps: [{ id: 'STEP-01', instruction: '上传模板并执行试算', uses: ['forecast-input'], expected: '试算完成' }],
      results: [{ id: 'RESULT-01', name: '锁定结果', actual: '锁定结果表格', expected: { file: 'expected-result' }, match: 'table' }],
    }), 'utf8');
    const fakeCli = path.join(root, 'fake-betterwright');
    await writeFile(fakeCli, `#!/bin/sh
cat > "${path.join(root, 'prompt.txt')}"
printf '%s' '{"ok":true,"answer":"{\\"summary\\":\\"通过\\",\\"steps\\":[{\\"id\\":\\"STEP-01\\",\\"status\\":\\"passed\\",\\"actual\\":\\"试算完成\\",\\"proof\\":null,\\"error\\":null}],\\"results\\":[{\\"id\\":\\"RESULT-01\\",\\"status\\":\\"matched\\",\\"actual\\":\\"结果一致\\",\\"proof\\":null,\\"error\\":null}]}","steps":2,"proof":null}'
`, 'utf8');
    await chmod(fakeCli, 0o700);
    const previousHome = process.env.BETTERWRIGHT_HOME;
    process.env.BETTERWRIGHT_HOME = path.join(root, 'betterwright-home');
    try {
      const run = await executeAcceptance({ projectRoot: root, config: defaultConfig('demo'), betterwrightBinary: fakeCli });
      expect(run.status).toBe('passed');
      expect(run.source.digest).toMatch(/^sha256:/);
      expect(run.workflowSteps?.[0]?.id).toBe('STEP-01');
      expect(run.resultAssertions?.[0]?.status).toBe('passed');
      const prompt = await readFile(path.join(root, 'prompt.txt'), 'utf8');
      expect(prompt).toContain('业务步骤（必须按顺序执行）');
      expect(prompt).toContain('STEP-01：上传模板并执行试算');
      expect(prompt).toContain('forecast-input：角色=input');
      expect(prompt).toContain('expected-result：角色=expected');
      expect(prompt).toContain('不得上传到被测系统');
    } finally {
      if (previousHome === undefined) delete process.env.BETTERWRIGHT_HOME;
      else process.env.BETTERWRIGHT_HOME = previousHome;
    }
  });

  it('阻止 Bundle 文件通过符号链接逃逸用例目录', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-bundle-escape-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'auto-e2e-bundle-outside-'));
    const bundle = path.join(root, '.auto-e2e', 'specs', 'escape');
    await mkdir(path.join(bundle, 'inputs'), { recursive: true });
    await writeFile(path.join(outside, 'secret.xlsx'), 'secret', 'utf8');
    await symlink(path.join(outside, 'secret.xlsx'), path.join(bundle, 'inputs', 'secret.xlsx'));
    await writeFile(path.join(bundle, 'spec.json'), JSON.stringify({
      schemaVersion: 2,
      taskId: 'ESCAPE-01',
      title: '非法文件',
      requirement: '不读取目录外文件',
      files: [{ id: 'secret', role: 'input', path: 'inputs/secret.xlsx' }],
      steps: [{ id: 'STEP-01', instruction: '上传', uses: ['secret'], expected: '完成' }],
      results: [{ id: 'RESULT-01', name: '结果', actual: '页面', expected: '完成', match: 'equals' }],
    }), 'utf8');
    await expect(loadAcceptanceRequirements({ projectRoot: root })).rejects.toThrow(/不能逃逸用例目录/);
  });

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

  it('按并发上限运行多用例套件并按原顺序保存汇总报告', async () => {
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

    let activeCases = 0;
    let maxActiveCases = 0;
    const run = await executeAcceptance({
      projectRoot: root,
      config: defaultConfig('demo'),
      betterwrightBinary: fakeCli,
      session: 'suite-session',
      concurrency: 2,
      lifecycle: {
        onCaseStarting: () => {
          activeCases += 1;
          maxActiveCases = Math.max(maxActiveCases, activeCases);
        },
        onCaseCompleted: () => {
          activeCases -= 1;
        },
      },
    });
    expect(run.schemaVersion).toBe(2);
    if (run.schemaVersion !== 2) throw new Error('expected suite run');
    expect(run.status).toBe('passed');
    expect(maxActiveCases).toBe(2);
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
