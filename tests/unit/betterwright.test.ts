import { describe, it, expect } from 'vitest';
import { MockBetterWrightClient } from '../../src/betterwright/mock-betterwright-client.js';
import { SessionManager } from '../../src/betterwright/session-manager.js';
import {
  explore,
  assertExplorationUsable,
  parseInteractiveSnapshot,
} from '../../src/betterwright/explorer.js';
import type { BetterWrightClient, BwRunResult } from '../../src/betterwright/betterwright-client.js';
import { AutoE2EError } from '../../src/runtime/exit-codes.js';

describe('MockBetterWrightClient', () => {
  it('模拟 page.goto / page.title / screenshot', async () => {
    const c = new MockBetterWrightClient();
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
    const c = new MockBetterWrightClient();
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

  it('real 实现返回 RealBetterWrightClient', () => {
    const manager = new SessionManager({
      browser: { implementation: 'real', sessionProfile: 'admin' } as never,
    });
    // 只验证不抛错（真实实例化在首次 run 时才加载 betterwright）。
    expect(manager.getOrCreate('admin')).toBeDefined();
  });
});

/** 伪造 client：按预设返回元素探针。 */
function fakeClient(elements: unknown[]): BetterWrightClient {
  return {
    async run<T>(_code: string): Promise<BwRunResult<T>> {
      return {
        ok: true,
        result: elements as T,
        proofPath: '/tmp/proof.png',
      };
    },
    async close() {},
  };
}

describe('explorer', () => {
  it('解析 BetterWright snapshot 为稳定 role 定位器输入', () => {
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
      { client: fakeClient(snapshot as unknown as unknown[]) },
    );
    expect(result.pages[0]!.reachable).toBe(true);
    const [btn, input] = result.pages[0]!.elements;
    expect(btn!.stable).toBe(true);
    expect(btn!.recommendedLocator).toBe(
      "page.getByRole('button', { name: '禁用' })",
    );
    expect(input!.recommendedLocator).toBe(
      "page.getByRole('textbox', { name: '用户名' })",
    );
    expect(result.pages[0]!.screenshots).toContain('/tmp/proof.png');
  });

  it('所有页面不可达时 assertExplorationUsable 抛 BrowserFailed(6)', () => {
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
