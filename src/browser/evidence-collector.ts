/**
 * 证据收集：截图与探索结果落盘。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserClient } from './browser-client.js';
import type { ExploreResult } from '../domain/explore-result.js';

/**
 * 通过 client 调用 screenshot 收集 proof 截图，返回路径。
 * 失败时返回 undefined，不阻断主流程。
 */
export async function collectScreenshot(
  client: BrowserClient,
  _route: string,
): Promise<string | undefined> {
  try {
    const res = await client.run<string>("screenshot({kind:'proof'})");
    if (res.ok) {
      return res.proofPath ?? res.result;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** 把探索结果写入 exploration.json。 */
export async function saveExploration(
  dir: string,
  result: ExploreResult,
): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'exploration.json');
  await fs.writeFile(filePath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return filePath;
}
