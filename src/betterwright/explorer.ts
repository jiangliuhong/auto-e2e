/**
 * 页面探索器（plan §10）。
 *
 * 输入 ExploreRequest，使用 BetterWrightClient 访问每个 route，收集：
 * - 页面 URL、标题、是否可达
 * - 关键元素与推荐定位器（按优先级：getByTestId → getByRole → getByLabel → ...）
 * - 观察到的网络请求
 * - 截图证据
 *
 * 输出 ExploreResult。定位器优先级在 chooseLocator 中体现；禁止默认使用长 CSS 路径。
 */
import type { BetterWrightClient } from './betterwright-client.js';
import type {
  ExploreRequest,
  ExploreResult,
} from '../domain/explore-result.js';
import { AutoE2EError } from '../runtime/exit-codes.js';

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
  elements: ProbeElement[];
  observedRequests: Array<{ method: string; url: string; status?: number }>;
}

export interface ExplorerOptions {
  client: BetterWrightClient;
  session?: string;
  /** 单页面超时（ms），超时视为不可达。 */
  timeoutMs?: number;
}

export async function explore(
  request: ExploreRequest,
  opts: ExplorerOptions,
): Promise<ExploreResult> {
  const pages: ExploreResult['pages'] = [];
  const blockers: string[] = [];

  for (const route of request.routes) {
    const fullUrl = resolveUrl(request.baseUrl, route);
    try {
      const probe = await probeRoute(opts.client, fullUrl, route, opts.session);
      if (!probe.reachable) {
        blockers.push(`无法访问 ${route}`);
      }
      pages.push({
        route,
        title: probe.title,
        reachable: probe.reachable,
        elements: probe.elements.map((e) => chooseLocator(e)),
        observedRequests: probe.observedRequests,
        screenshots: probe.screenshots,
      });
    } catch (err) {
      blockers.push(
        `探索 ${route} 异常：${err instanceof Error ? err.message : String(err)}`,
      );
      pages.push({
        route,
        reachable: false,
        elements: [],
        observedRequests: [],
        screenshots: [],
      });
    }
  }

  return { taskId: request.taskId, pages, blockers };
}

async function probeRoute(
  client: BetterWrightClient,
  fullUrl: string,
  route: string,
  session?: string,
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
      elements: [],
      observedRequests: [],
      screenshots: [],
    };
  }

  // 2. 收集标题。
  const titleRes = await client.run<string>('return page.title()', sessionOpts);
  const title = titleRes.ok ? titleRes.result : undefined;

  // 3. BetterWright 官方暴露 snapshot()，从可交互 accessibility snapshot
  //    提取 role/name，供生成器构造稳定的 getByRole 定位器。
  const elementsRes = await client.run<string>(
    'return await snapshot({ interactive: true })',
    sessionOpts,
  );
  const elements =
    elementsRes.ok && typeof elementsRes.result === 'string'
      ? parseInteractiveSnapshot(elementsRes.result)
      : [];

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
    url: fullUrl,
    title,
    reachable: true,
    elements,
    observedRequests: [],
    screenshots,
  };
}

/** 解析 BetterWright accessibility snapshot 中的可交互节点。 */
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
 * 定位器优先级选择（plan §10.3）。
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
    fallbacks.push(`page.getByRole('${el.role}'${el.name ? `, { name: '${escapeQuote(el.name)}' }` : ''})`);
  }
  if (el.label) {
    fallbacks.push(`page.getByLabel('${escapeQuote(el.label)}')`);
  }
  if (el.placeholder) {
    fallbacks.push(`page.getByPlaceholder('${escapeQuote(el.placeholder)}')`);
  }
  if (el.text) {
    fallbacks.push(`page.getByText('${escapeQuote(el.text)}')`);
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
  return s.replace(/'/g, "\\'");
}

/** 若探索完全被阻塞（所有页面不可达），抛 BrowserFailed。 */
export function assertExplorationUsable(result: ExploreResult): void {
  const anyReachable = result.pages.some((p) => p.reachable);
  if (!anyReachable) {
    throw new AutoE2EError(
      6,
      `所有目标页面不可达：${result.blockers.join('; ')}`,
    );
  }
}
