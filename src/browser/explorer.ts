/**
 * 页面探索器。
 *
 * 输入 ExploreRequest，使用 BrowserClient 访问每个 route，收集：
 * - 页面 URL、标题、是否可达
 * - 关键元素与推荐定位器（按优先级：getByTestId → getByRole → getByLabel → ...）
 * - 观察到的网络请求
 * - 截图证据
 *
 * 输出 ExploreResult。定位器优先级在 chooseLocator 中体现；禁止默认使用长 CSS 路径。
 */
import type { BrowserClient } from './browser-client.js';
import type {
  ExploreRequest,
  ExploreResult,
} from '../domain/explore-result.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import type {
  ExplorationDecision,
  ExplorationDecisionInput,
  ExploredAction,
} from '../domain/exploration-action.js';

/** 元素的原始探针信息（来自沙箱代码返回的结构）。 */
interface ProbeElement {
  description: string;
  testid?: string;
  role?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  text?: string;
}

/** 单个页面探测到的数据。 */
interface PageProbe {
  route: string;
  url: string;
  title?: string;
  reachable: boolean;
  ready: boolean;
  snapshotError?: string;
  elements: ExploreResult['pages'][number]['elements'];
  actions: ExploredAction[];
  observedRequests: Array<{ method: string; url: string; status?: number }>;
}

export interface ExplorerOptions {
  client: BrowserClient;
  session?: string;
  /** 单页面超时（ms），超时视为不可达。 */
  timeoutMs?: number;
  /** 提供时启用受约束的状态化探索；模型只能选择当前已验证元素。 */
  decideAction?: (
    input: ExplorationDecisionInput,
  ) => Promise<ExplorationDecision>;
  /** 单路由最多执行的安全探索动作数。 */
  maxActionsPerRoute?: number;
}

const DEFAULT_PAGE_READY_TIMEOUT_MS = 15_000;
const SNAPSHOT_POLL_INTERVAL_MS = 300;
const REQUIRED_STABLE_SNAPSHOTS = 2;
const DEFAULT_MAX_ACTIONS_PER_ROUTE = 12;
const WRITE_ACTION_PATTERN =
  /(删除|移除|保存|提交|确认|支付|购买|发布|发送|delete|remove|save|submit|confirm|pay|purchase|publish|send)/i;

export async function explore(
  request: ExploreRequest,
  opts: ExplorerOptions,
): Promise<ExploreResult> {
  const pages: ExploreResult['pages'] = [];
  const blockers: string[] = [];

  for (const route of request.routes) {
    const fullUrl = resolveUrl(request.baseUrl, route);
    try {
      const probe = await probeRoute(
        opts.client,
        fullUrl,
        route,
        opts.session,
        opts.timeoutMs,
        {
          taskId: request.taskId,
          acceptanceCriteria: request.acceptanceCriteria,
          testCases: request.testCases,
          decideAction: opts.decideAction,
          maxActions: opts.maxActionsPerRoute ?? DEFAULT_MAX_ACTIONS_PER_ROUTE,
        },
      );
      if (!probe.reachable) {
        blockers.push(`无法访问 ${route}`);
      }
      pages.push({
        route,
        url: probe.url,
        title: probe.title,
        reachable: probe.reachable,
        ready: probe.ready,
        snapshotError: probe.snapshotError,
        elements: probe.elements,
        actions: probe.actions,
        observedRequests: probe.observedRequests,
        screenshots: probe.screenshots,
      });
      if (probe.reachable && !probe.ready) {
        blockers.push(`页面 ${route} 未就绪：${probe.snapshotError ?? '未获得可交互快照'}`);
      } else if (probe.ready && probe.elements.length === 0) {
        blockers.push(`页面 ${route} 没有唯一且可见的稳定定位器`);
      }
    } catch (err) {
      blockers.push(
        `探索 ${route} 异常：${err instanceof Error ? err.message : String(err)}`,
      );
      pages.push({
        route,
        reachable: false,
        ready: false,
        snapshotError: err instanceof Error ? err.message : String(err),
        elements: [],
        actions: [],
        observedRequests: [],
        screenshots: [],
      });
    }
  }

  return { taskId: request.taskId, pages, blockers };
}

async function probeRoute(
  client: BrowserClient,
  fullUrl: string,
  route: string,
  session?: string,
  timeoutMs = DEFAULT_PAGE_READY_TIMEOUT_MS,
  scenario?: {
    taskId: string;
    acceptanceCriteria: string[];
    testCases: unknown[];
    decideAction?: (input: ExplorationDecisionInput) => Promise<ExplorationDecision>;
    maxActions: number;
  },
): Promise<PageProbe & { screenshots: string[] }> {
  const sessionOpts = session ? { session } : undefined;

  // 1. 导航。
  const gotoRes = await client.run(
    `await page.goto('${fullUrl}', { waitUntil: 'domcontentloaded' })`,
    sessionOpts,
  );
  if (!gotoRes.ok) {
    return {
      route,
      url: fullUrl,
      reachable: false,
      ready: false,
      snapshotError: gotoRes.error ?? `无法导航到 ${fullUrl}`,
      elements: [],
      actions: [],
      observedRequests: [],
      screenshots: [],
    };
  }

  // 2. 收集标题与真实 URL。
  const titleRes = await client.run<string>('return page.title()', sessionOpts);
  const title = titleRes.ok ? titleRes.result : undefined;

  const urlRes = await client.run<string>('return page.url()', sessionOpts);
  const finalUrl = urlRes.ok && typeof urlRes.result === 'string' ? urlRes.result : fullUrl;

  // 3. 连续获得相同的非空交互快照才视为页面已就绪，避免在 hydration、
  //    登录校验或 loading 中间态上生成定位器。
  const snapshot = await waitForStableInteractiveSnapshot(
    client,
    sessionOpts,
    timeoutMs,
  );
  const candidates = snapshot.text
    ? parseInteractiveSnapshot(snapshot.text).map((element) => chooseLocator(element))
    : [];
  const initialElements = snapshot.ready
    ? await validateLocators(client, candidates, sessionOpts)
    : [];

  const driven =
    snapshot.ready && scenario?.decideAction && initialElements.length > 0
      ? await driveScenario({
          client,
          sessionOpts,
          timeoutMs,
          route,
          taskId: scenario.taskId,
          acceptanceCriteria: scenario.acceptanceCriteria,
          testCases: scenario.testCases,
          decideAction: scenario.decideAction,
          maxActions: scenario.maxActions,
          initialUrl: finalUrl,
          initialTitle: title,
          initialSnapshot: snapshot.text!,
          initialElements,
        })
      : {
          ready: snapshot.ready,
          error: snapshot.error,
          url: finalUrl,
          title,
          elements: initialElements,
          actions: [] as ExploredAction[],
        };

  // 4. 收集截图证据。
  const shotRes = await client.run<{ path?: string; media?: string }>(
    "return await screenshot({kind:'proof'})",
    sessionOpts,
  );
  const screenshots: string[] = [];
  if (shotRes.ok) {
    const resultPath =
      typeof shotRes.result === 'object' && shotRes.result
        ? shotRes.result.path ?? stripMediaPrefix(shotRes.result.media)
        : undefined;
    const artifact = shotRes.artifacts?.find((a) => a.kind === 'proof') ?? shotRes.artifacts?.[0];
    const p =
      shotRes.proofPath ??
      resultPath ??
      artifact?.path ??
      stripMediaPrefix(artifact?.media);
    if (p) screenshots.push(p);
  }

  return {
    route,
    url: driven.url,
    title: driven.title,
    reachable: true,
    ready: driven.ready,
    snapshotError: driven.error,
    elements: driven.elements,
    actions: driven.actions,
    observedRequests: [],
    screenshots,
  };
}

interface DriveScenarioOptions {
  client: BrowserClient;
  sessionOpts: { session: string } | undefined;
  timeoutMs: number;
  route: string;
  taskId: string;
  acceptanceCriteria: string[];
  testCases: unknown[];
  decideAction: (input: ExplorationDecisionInput) => Promise<ExplorationDecision>;
  maxActions: number;
  initialUrl: string;
  initialTitle?: string;
  initialSnapshot: string;
  initialElements: ExploreResult['pages'][number]['elements'];
}

async function driveScenario(
  opts: DriveScenarioOptions,
): Promise<{
  ready: boolean;
  error?: string;
  url: string;
  title?: string;
  elements: ExploreResult['pages'][number]['elements'];
  actions: ExploredAction[];
}> {
  let currentUrl = opts.initialUrl;
  let currentTitle = opts.initialTitle;
  let currentSnapshot = opts.initialSnapshot;
  let currentElements = opts.initialElements;
  const allElements = [...opts.initialElements];
  const actions: ExploredAction[] = [];

  for (let step = 1; step <= opts.maxActions; step++) {
    let decision: ExplorationDecision;
    try {
      decision = await opts.decideAction({
        taskId: opts.taskId,
        route: opts.route,
        acceptanceCriteria: opts.acceptanceCriteria,
        testCases: opts.testCases,
        current: {
          url: currentUrl,
          title: currentTitle,
          elements: currentElements.map((element, index) => ({
            index,
            description: element.description,
            locator: element.recommendedLocator,
            enabled: element.enabled ?? true,
          })),
        },
        history: actions.map((action) => ({
          step: action.step,
          description: action.description,
          status: action.status,
        })),
      });
    } catch (error) {
      return {
        ready: false,
        error: `探索决策失败：${error instanceof Error ? error.message : String(error)}`,
        url: currentUrl,
        title: currentTitle,
        elements: allElements,
        actions,
      };
    }

    if (decision.type === 'complete') {
      if (isLikelyAuthenticationGate(currentElements)) {
        return {
          ready: false,
          error: '模型在登录门禁仍可见时结束探索，已拒绝把该状态视为完成',
          url: currentUrl,
          title: currentTitle,
          elements: allElements,
          actions,
        };
      }
      if (!urlMatchesRoute(currentUrl, opts.route)) {
        return {
          ready: false,
          error: `模型结束探索时仍未到达目标路由 ${opts.route}（当前 ${currentUrl}）`,
          url: currentUrl,
          title: currentTitle,
          elements: allElements,
          actions,
        };
      }
      return {
        ready: true,
        url: currentUrl,
        title: currentTitle,
        elements: allElements,
        actions,
      };
    }
    if (decision.type === 'blocked') {
      return {
        ready: false,
        error: `状态化探索被阻塞：${decision.reason}`,
        url: currentUrl,
        title: currentTitle,
        elements: allElements,
        actions,
      };
    }

    const target = currentElements[decision.elementIndex];
    if (!target) {
      return {
        ready: false,
        error: `探索决策引用了不存在的元素索引 ${decision.elementIndex}`,
        url: currentUrl,
        title: currentTitle,
        elements: allElements,
        actions,
      };
    }
    if (target.enabled === false || WRITE_ACTION_PATTERN.test(target.description)) {
      actions.push({
        step,
        type: 'click',
        description: target.description,
        locator: target.recommendedLocator,
        reason: decision.reason,
        beforeUrl: currentUrl,
        status: 'blocked',
        error: target.enabled === false ? '目标元素不可用' : '探索阶段禁止业务写入动作',
      });
      return {
        ready: false,
        error: `已阻止不安全探索动作：${target.description}`,
        url: currentUrl,
        title: currentTitle,
        elements: allElements,
        actions,
      };
    }

    const action = await executeVerifiedClick(
      opts.client,
      target.recommendedLocator,
      opts.sessionOpts,
    );
    if (!action.ok) {
      actions.push({
        step,
        type: 'click',
        description: target.description,
        locator: target.recommendedLocator,
        reason: decision.reason,
        beforeUrl: currentUrl,
        status: 'failed',
        error: action.error ?? '点击失败',
      });
      continue;
    }

    const nextSnapshot = await waitForStableInteractiveSnapshot(
      opts.client,
      opts.sessionOpts,
      opts.timeoutMs,
    );
    if (!nextSnapshot.ready || !nextSnapshot.text) {
      actions.push({
        step,
        type: 'click',
        description: target.description,
        locator: target.recommendedLocator,
        reason: decision.reason,
        beforeUrl: currentUrl,
        status: 'failed',
        error: nextSnapshot.error ?? '动作后未获得稳定快照',
      });
      return {
        ready: false,
        error: nextSnapshot.error ?? `动作 ${target.description} 后页面未就绪`,
        url: currentUrl,
        title: currentTitle,
        elements: allElements,
        actions,
      };
    }

    const urlResult = await opts.client.run<string>('return page.url()', opts.sessionOpts);
    const titleResult = await opts.client.run<string>('return page.title()', opts.sessionOpts);
    const nextUrl =
      urlResult.ok && typeof urlResult.result === 'string' ? urlResult.result : currentUrl;
    const nextTitle =
      titleResult.ok && typeof titleResult.result === 'string'
        ? titleResult.result
        : currentTitle;
    const nextCandidates = parseInteractiveSnapshot(nextSnapshot.text).map((element) =>
      chooseLocator(element),
    );
    const nextElements = await validateLocators(
      opts.client,
      nextCandidates,
      opts.sessionOpts,
    );
    const changed =
      nextUrl !== currentUrl ||
      snapshotSignature(nextSnapshot.text) !== snapshotSignature(currentSnapshot);
    actions.push({
      step,
      type: 'click',
      description: target.description,
      locator: target.recommendedLocator,
      reason: decision.reason,
      beforeUrl: currentUrl,
      afterUrl: nextUrl,
      status: changed ? 'success' : 'failed',
      error: changed ? undefined : '点击后页面状态没有变化',
    });

    currentUrl = nextUrl;
    currentTitle = nextTitle;
    currentSnapshot = nextSnapshot.text;
    currentElements = nextElements;
    mergeElements(allElements, nextElements);
  }

  return {
    ready: false,
    error: `状态化探索超过最大动作数 ${opts.maxActions}`,
    url: currentUrl,
    title: currentTitle,
    elements: allElements,
    actions,
  };
}

function isLikelyAuthenticationGate(
  elements: ExploreResult['pages'][number]['elements'],
): boolean {
  const hasLoginAction = elements.some((element) =>
    /^(?:(?:login|log in|sign in)\s*)?登录$|^(?:login|log in|sign in)$/i.test(
      element.description.trim(),
    ),
  );
  const hasAccountChoice = elements.some((element) =>
    /(请选择用户|选择用户|用户列表|select user|choose user)/i.test(element.description),
  );
  return hasLoginAction && hasAccountChoice;
}

function urlMatchesRoute(currentUrl: string, route: string): boolean {
  if (/^https?:\/\//.test(route)) {
    return currentUrl === route || currentUrl.startsWith(`${route}?`);
  }
  try {
    const expectedPath = new URL(route, currentUrl).pathname.replace(/\/$/, '') || '/';
    const currentPath = new URL(currentUrl).pathname.replace(/\/$/, '') || '/';
    if (expectedPath === '/') return true;
    return currentPath === expectedPath || currentPath.startsWith(`${expectedPath}/`);
  } catch {
    return false;
  }
}

async function executeVerifiedClick(
  client: BrowserClient,
  locatorExpression: string,
  sessionOpts: { session: string } | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const result = await client.run(
    [
      `const locator = ${locatorExpression};`,
      'const count = await locator.count();',
      "if (count !== 1) throw new Error(`定位器匹配 ${count} 个元素`);",
      "if (!await locator.isVisible()) throw new Error('目标元素不可见');",
      "if (!await locator.isEnabled()) throw new Error('目标元素不可用');",
      'await human.click(locator);',
    ].join('\n'),
    sessionOpts,
  );
  return { ok: result.ok, error: result.error };
}

function mergeElements(
  target: ExploreResult['pages'][number]['elements'],
  incoming: ExploreResult['pages'][number]['elements'],
): void {
  for (const element of incoming) {
    if (
      !target.some(
        (existing) =>
          existing.description === element.description &&
          existing.recommendedLocator === element.recommendedLocator,
      )
    ) {
      target.push(element);
    }
  }
}

async function waitForStableInteractiveSnapshot(
  client: BrowserClient,
  sessionOpts: { session: string } | undefined,
  timeoutMs: number,
): Promise<{ ready: boolean; text?: string; error?: string }> {
  const deadline = Date.now() + timeoutMs;
  let previousSignature = '';
  let stableSamples = 0;
  let lastError: string | undefined;

  do {
    const result = await client.run<string>(
      'return await snapshot({ interactive: true })',
      sessionOpts,
    );
    if (result.ok && typeof result.result === 'string') {
      const current = result.result.trim();
      const hasInteractiveElements = parseInteractiveSnapshot(current).length > 0;
      if (hasInteractiveElements) {
        const signature = snapshotSignature(current);
        stableSamples = signature === previousSignature ? stableSamples + 1 : 1;
        previousSignature = signature;
        if (stableSamples >= REQUIRED_STABLE_SNAPSHOTS) {
          return { ready: true, text: current };
        }
      } else {
        previousSignature = '';
        stableSamples = 0;
        lastError = '可交互快照为空';
      }
    } else {
      lastError = result.error ?? '未返回可交互快照';
    }

    if (Date.now() < deadline) {
      await client.run(
        `await page.waitForTimeout(${SNAPSHOT_POLL_INTERVAL_MS})`,
        sessionOpts,
      );
    }
  } while (Date.now() < deadline);

  return {
    ready: false,
    error: `等待页面稳定超时（${timeoutMs}ms）：${lastError ?? '未获得稳定快照'}`,
  };
}

function snapshotSignature(snapshotText: string): string {
  return snapshotText.replace(/\[ref=[^\]]+\]/g, '[ref=*]').trim();
}

async function validateLocators(
  client: BrowserClient,
  candidates: ExploreResult['pages'][number]['elements'],
  sessionOpts: { session: string } | undefined,
): Promise<ExploreResult['pages'][number]['elements']> {
  const verified: ExploreResult['pages'][number]['elements'] = [];
  for (const candidate of candidates) {
    if (!candidate.recommendedLocator) continue;
    const result = await client.run<{
      count: number;
      visible: boolean;
      enabled: boolean;
    }>(
      [
        `const locator = ${candidate.recommendedLocator};`,
        'const count = await locator.count();',
        'return {',
        '  count,',
        '  visible: count === 1 ? await locator.isVisible() : false,',
        '  enabled: count === 1 ? await locator.isEnabled() : false,',
        '};',
      ].join('\n'),
      sessionOpts,
    );
    if (!result.ok || !result.result) continue;
    const { count, visible, enabled } = result.result;
    if (count !== 1 || !visible) continue;
    verified.push({
      ...candidate,
      stable: candidate.stable && count === 1,
      observedCount: count,
      visible,
      enabled,
      verified: true,
    });
  }
  return verified;
}

/** 解析 accessibility snapshot 中的可交互节点。 */
export function parseInteractiveSnapshot(snapshotText: string): ProbeElement[] {
  const elements: ProbeElement[] = [];
  for (const line of snapshotText.split('\n')) {
    const match = line.match(
      /^\s*-\s+([a-zA-Z][\w-]*)(?:\s+"((?:[^"\\]|\\.)*)")?.*\[ref=[^\]]+\]/,
    );
    if (!match) continue;
    const role = match[1]!;
    const name = match[2]?.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    elements.push({
      description: name || role,
      role,
      name,
      text: name,
    });
  }
  return elements;
}

function stripMediaPrefix(media?: string): string | undefined {
  return media?.startsWith('MEDIA:') ? media.slice('MEDIA:'.length) : media;
}

function resolveUrl(baseUrl: string, route: string): string {
  if (/^https?:\/\//.test(route)) return route;
  return new URL(route, baseUrl).toString();
}

/**
 * 定位器优先级选择。
 * getByTestId → getByRole → getByLabel → getByPlaceholder → getByText
 * 禁止默认使用脆弱的长 CSS 路径。
 */
function chooseLocator(el: ProbeElement): ExploreResult['pages'][number]['elements'][number] {
  const fallbacks: string[] = [];

  if (el.testid) {
    const primary = `page.getByTestId('${el.testid}')`;
    return {
      description: el.description,
      recommendedLocator: primary,
      fallbackLocators: fallbacks,
      stable: true,
    };
  }
  if (el.role) {
    fallbacks.push(`page.getByRole('${el.role}'${el.name ? `, { name: '${escapeQuote(el.name)}', exact: true }` : ''})`);
  }
  if (el.label) {
    fallbacks.push(`page.getByLabel('${escapeQuote(el.label)}', { exact: true })`);
  }
  if (el.placeholder) {
    fallbacks.push(`page.getByPlaceholder('${escapeQuote(el.placeholder)}', { exact: true })`);
  }
  if (el.text) {
    fallbacks.push(`page.getByText('${escapeQuote(el.text)}', { exact: true })`);
  }

  const recommended = fallbacks[0];
  if (!recommended) {
    // 无任何稳定信号：标记为不稳定，不推荐脆弱 CSS。
    return {
      description: el.description,
      recommendedLocator: '',
      fallbackLocators: [],
      stable: false,
    };
  }
  return {
    description: el.description,
    recommendedLocator: recommended,
    fallbackLocators: fallbacks.slice(1),
    stable: el.role !== undefined,
  };
}

function escapeQuote(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** 若探索完全被阻塞（所有页面不可达），抛 BrowserFailed。 */
export function assertExplorationUsable(result: ExploreResult): void {
  const unusablePages = result.pages.filter((page) => {
    const ready = page.ready ?? page.reachable;
    const hasVerifiedLocator = page.elements.some(
      (element) => element.verified ?? element.stable,
    );
    return !page.reachable || !ready || !hasVerifiedLocator;
  });
  if (result.pages.length === 0 || unusablePages.length > 0) {
    const details = unusablePages.map((page) => {
      if (!page.reachable) return `${page.route} 不可达`;
      if (page.ready === false) {
        return `${page.route} 未就绪（${page.snapshotError ?? '无稳定快照'}）`;
      }
      return `${page.route} 没有已验证定位器`;
    });
    throw new AutoE2EError(
      ExitCode.BrowserFailed,
      `探索证据不足，已拒绝生成测试：${details.join('; ') || result.blockers.join('; ')}`,
    );
  }
}
