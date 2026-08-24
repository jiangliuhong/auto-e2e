import { describe, it, expect } from 'vitest';
import { MockBrowserClient } from '../../src/browser/mock-browser-client.js';
import { SessionManager } from '../../src/browser/session-manager.js';
import {
  explore,
  assertExplorationUsable,
  parseInteractiveSnapshot,
} from '../../src/browser/explorer.js';
import type { BrowserClient, BrowserRunResult } from '../../src/browser/browser-client.js';
import { AutoE2EError } from '../../src/runtime/exit-codes.js';

describe('MockBrowserClient', () => {
  it('模拟 page.goto / page.title / screenshot', async () => {
    const c = new MockBrowserClient();
    await c.run("await page.goto('http://localhost:3000/users')");
    const title = await c.run<string>('return page.title()');
    expect(title.result).toBe('users');
    const url = await c.run<string>('return page.url()');
    expect(url.result).toBe('http://localhost:3000/users');
    const shot = await c.run<string>("screenshot({kind:'proof'})");
    expect(shot.ok).toBe(true);
    expect(shot.proofPath).toBeTruthy();
  });

  it('snapshot() 返回可交互 accessibility tree', async () => {
    const c = new MockBrowserClient();
    const res = await c.run<string>('return await snapshot({ interactive: true })');
    expect(res.ok).toBe(true);
    expect(res.result).toContain('button "禁用"');
  });
});

describe('SessionManager', () => {
  it('同 profile 复用 client，关闭后清空', async () => {
    const manager = new SessionManager({
      browser: { implementation: 'mock', sessionProfile: 'admin' } as never,
    });
    const a = manager.getOrCreate('admin');
    const b = manager.getOrCreate('admin');
    expect(a).toBe(b);
    await manager.closeAll();
  });

  it('real 实现返回 RealBrowserClient', () => {
    const manager = new SessionManager({
      browser: { implementation: 'real', sessionProfile: 'admin' } as never,
    });
    expect(manager.getOrCreate('admin')).toBeDefined();
  });
});

/** 伪造 client：返回稳定快照，并允许控制定位器验证结果。 */
function fakeClient(
  snapshot: string | (() => string),
  locatorResult: { count: number; visible: boolean; enabled: boolean } = {
    count: 1,
    visible: true,
    enabled: true,
  },
): BrowserClient {
  return {
    async run<T>(code: string): Promise<BrowserRunResult<T>> {
      if (code.includes('page.url()')) {
        return { ok: true, result: 'http://localhost:3000/users' as T };
      }
      if (code.includes('snapshot(')) {
        return {
          ok: true,
          result: (typeof snapshot === 'function' ? snapshot() : snapshot) as T,
        };
      }
      if (code.includes('const locator = page.getBy')) {
        return { ok: true, result: locatorResult as T };
      }
      return {
        ok: true,
        proofPath: '/tmp/proof.png',
      };
    },
    async close() {},
  } as BrowserClient;
}

function statefulLoginClient(): BrowserClient {
  let state: 'login' | 'options' | 'selected' | 'home' = 'login';
  const snapshots = {
    login: '- combobox "请选择用户" [ref=e1]\n- button "登录" [ref=e2]',
    options: '- option "用户A" [ref=e3]\n- button "登录" [ref=e2]',
    selected: '- combobox "用户A" [ref=e1]\n- button "登录" [ref=e2]',
    home: '- button "新增" [ref=e4]\n- link "模型结果" [ref=e5]',
  } as const;

  return {
    async run<T>(code: string): Promise<BrowserRunResult<T>> {
      if (code.includes('page.goto(')) {
        state = 'login';
        return { ok: true };
      }
      if (code.includes('human.click')) {
        if (code.includes("name: '请选择用户'")) state = 'options';
        else if (code.includes("name: '用户A'")) state = 'selected';
        else if (code.includes("name: '登录'")) state = 'home';
        return { ok: true };
      }
      if (code.includes('page.url()')) {
        const url = state === 'home' ? 'http://localhost:3000/home' : 'http://localhost:3000/';
        return { ok: true, result: url as T };
      }
      if (code.includes('page.title()')) {
        return { ok: true, result: (state === 'home' ? '首页' : '登录') as T };
      }
      if (code.includes('snapshot(')) {
        return { ok: true, result: snapshots[state] as T };
      }
      if (code.includes('const locator = page.getBy')) {
        return {
          ok: true,
          result: { count: 1, visible: true, enabled: true } as T,
        };
      }
      if (code.includes('screenshot(')) {
        return { ok: true, proofPath: '/tmp/stateful-proof.png' };
      }
      return { ok: true };
    },
    async close() {},
  } as BrowserClient;
}

describe('explorer', () => {
  it('解析 snapshot 为稳定 role 定位器输入', () => {
    expect(
      parseInteractiveSnapshot('- button "保存" [ref=e12]\n- textbox "邮箱" [ref=e13]'),
    ).toEqual([
      { description: '保存', role: 'button', name: '保存', text: '保存' },
      { description: '邮箱', role: 'textbox', name: '邮箱', text: '邮箱' },
    ]);
  });

  it('按定位器优先级选择 recommendedLocator', async () => {
    const snapshot =
      '- button "禁用" [ref=e1]\n- textbox "用户名" [ref=e2]';
    const result = await explore(
      {
        taskId: 'TASK-1',
        baseUrl: 'http://localhost:3000',
        routes: ['/users'],
        acceptanceCriteria: [],
        testCases: [],
      },
      { client: fakeClient(snapshot) },
    );
    expect(result.pages[0]!.reachable).toBe(true);
    expect(result.pages[0]!.ready).toBe(true);
    expect(result.pages[0]!.url).toBe('http://localhost:3000/users');
    const [btn, input] = result.pages[0]!.elements;
    expect(btn!.stable).toBe(true);
    expect(btn!.recommendedLocator).toBe(
      "page.getByRole('button', { name: '禁用', exact: true })",
    );
    expect(input!.recommendedLocator).toBe(
      "page.getByRole('textbox', { name: '用户名', exact: true })",
    );
    expect(btn).toMatchObject({ observedCount: 1, visible: true, verified: true });
    expect(result.pages[0]!.screenshots).toContain('/tmp/proof.png');
  });

  it('定位器名称使用精确匹配并安全转义', async () => {
    const result = await explore(
      {
        taskId: 'TASK-ESCAPE',
        baseUrl: 'http://localhost:3000',
        routes: ['/users'],
        acceptanceCriteria: [],
        testCases: [],
      },
      { client: fakeClient(`- button "Bob's \\\\ folder" [ref=e1]`) },
    );

    expect(result.pages[0]!.elements[0]!.recommendedLocator).toBe(
      "page.getByRole('button', { name: 'Bob\\'s \\\\ folder', exact: true })",
    );
  });

  it('页面稳定判断忽略临时 ref 重新编号', async () => {
    let ref = 0;
    const result = await explore(
      {
        taskId: 'TASK-REF',
        baseUrl: 'http://localhost:3000',
        routes: ['/users'],
        acceptanceCriteria: [],
        testCases: [],
      },
      { client: fakeClient(() => `- button "保存" [ref=e${++ref}]`) },
    );

    expect(result.pages[0]!.ready).toBe(true);
    expect(result.pages[0]!.elements).toHaveLength(1);
  });

  it('页面只有空快照时标记为未就绪并拒绝生成', async () => {
    const result = await explore(
      {
        taskId: 'TASK-EMPTY',
        baseUrl: 'http://localhost:3000',
        routes: ['/loading'],
        acceptanceCriteria: [],
        testCases: [],
      },
      { client: fakeClient(''), timeoutMs: 1 },
    );

    expect(result.pages[0]).toMatchObject({
      reachable: true,
      ready: false,
      elements: [],
    });
    expect(result.pages[0]!.snapshotError).toContain('等待页面稳定超时');
    expect(() => assertExplorationUsable(result)).toThrow(/探索证据不足/);
  });

  it('定位器不唯一时不把它交给生成器', async () => {
    const result = await explore(
      {
        taskId: 'TASK-DUPLICATE',
        baseUrl: 'http://localhost:3000',
        routes: ['/users'],
        acceptanceCriteria: [],
        testCases: [],
      },
      {
        client: fakeClient('- button "保存" [ref=e1]', {
          count: 2,
          visible: false,
          enabled: false,
        }),
      },
    );

    expect(result.pages[0]!.ready).toBe(true);
    expect(result.pages[0]!.elements).toEqual([]);
    expect(() => assertExplorationUsable(result)).toThrow(/没有已验证定位器/);
  });

  it('在同一会话中按已验证元素完成状态化登录探索', async () => {
    const result = await explore(
      {
        taskId: 'TASK-LOGIN',
        baseUrl: 'http://localhost:3000',
        routes: ['/'],
        acceptanceCriteria: ['选择页面提供的用户完成登录'],
        testCases: [{ steps: ['选择用户', '点击登录'] }],
      },
      {
        client: statefulLoginClient(),
        decideAction: async (input) => {
          const selectable =
            input.current.elements.find((element) => element.description === '请选择用户') ??
            input.current.elements.find((element) => element.locator.includes("getByRole('option'")) ??
            input.current.elements.find((element) => element.description === '登录');
          if (selectable) {
            return {
              type: 'click' as const,
              elementIndex: selectable.index,
              reason: `执行登录步骤：${selectable.description}`,
            };
          }
          return { type: 'complete' as const, reason: '已到达登录后页面' };
        },
      },
    );

    expect(result.pages[0]).toMatchObject({
      ready: true,
      url: 'http://localhost:3000/home',
    });
    expect(result.pages[0]!.actions).toHaveLength(3);
    expect(result.pages[0]!.actions!.every((action) => action.status === 'success')).toBe(true);
    expect(result.pages[0]!.elements.map((element) => element.description)).toEqual(
      expect.arrayContaining(['请选择用户', '用户A', '登录', '新增', '模型结果']),
    );
    expect(() => assertExplorationUsable(result)).not.toThrow();
  });

  it('状态化探索阻止保存等业务写入动作', async () => {
    const result = await explore(
      {
        taskId: 'TASK-SAFE',
        baseUrl: 'http://localhost:3000',
        routes: ['/form'],
        acceptanceCriteria: ['查看表单'],
        testCases: [],
      },
      {
        client: fakeClient('- button "保存" [ref=e1]'),
        decideAction: async () => ({
          type: 'click',
          elementIndex: 0,
          reason: '尝试保存',
        }),
      },
    );

    expect(result.pages[0]!.ready).toBe(false);
    expect(result.pages[0]!.snapshotError).toContain('已阻止不安全探索动作');
    expect(result.pages[0]!.actions).toEqual([
      expect.objectContaining({ description: '保存', status: 'blocked' }),
    ]);
    expect(() => assertExplorationUsable(result)).toThrow(/未就绪/);
  });

  it('登录门禁仍可见时拒绝模型误报完成', async () => {
    const result = await explore(
      {
        taskId: 'TASK-AUTH-GATE',
        baseUrl: 'http://localhost:3000',
        routes: ['/users'],
        acceptanceCriteria: ['登录后查看用户'],
        testCases: [],
      },
      {
        client: fakeClient(
          '- combobox "请选择用户" [ref=e1]\n- button "login 登录" [ref=e2]',
        ),
        decideAction: async () => ({ type: 'complete', reason: '错误地认为已完成' }),
      },
    );

    expect(result.pages[0]!.ready).toBe(false);
    expect(result.pages[0]!.snapshotError).toContain('登录门禁仍可见');
  });

  it('存在不可用页面时 assertExplorationUsable 抛 BrowserFailed(6)', () => {
    const unreachable = {
      taskId: 'T',
      pages: [{ route: '/x', reachable: false, elements: [], observedRequests: [], screenshots: [] }],
      blockers: ['无法访问 /x'],
    };
    expect(() => assertExplorationUsable(unreachable)).toThrow(AutoE2EError);
    try {
      assertExplorationUsable(unreachable);
    } catch (e) {
      expect((e as AutoE2EError).exitCode).toBe(6);
    }
  });
});
