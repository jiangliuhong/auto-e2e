/**
 * 失败分析器（plan §13.2, §16 阶段八）。
 *
 * 读取最近一次 Playwright JSON 结果与 result.json，对每个失败：
 * - 收集错误堆栈、测试步骤、截图路径、请求失败信息。
 * - 调用 PiClient.analyzeFailure 进行分类（product_defect / test_defect / ...）。
 * - 输出 confidence。
 *
 * 约束（plan §13.2）：失败分析不会覆盖原始 Playwright 错误。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PiClient } from '../agent/pi-client.js';
import { TestResultSchema, type FailureEntry, type TestResult } from '../domain/test-result.js';
import {
  parsePlaywrightJson,
  type PlaywrightJsonReport,
} from '../playwright/result-parser.js';

export interface AnalyzeFailuresInput {
  /** reports/latest 目录（绝对路径）。 */
  latestDir: string;
  /** artifacts 目录（绝对路径），用于查找截图/trace。 */
  artifactDir: string;
  projectRoot: string;
  client: PiClient;
}

export interface AnalyzeFailuresResult {
  failures: FailureEntry[];
  /** 更新后的 TestResult（保留原始 summary，仅刷新 failures）。 */
  updatedResult: TestResult | undefined;
}

/**
 * 分析最近一次结果。返回分类后的失败条目，并写回 result.json（仅 failures 字段）。
 */
export async function analyzeLastRun(input: AnalyzeFailuresInput): Promise<AnalyzeFailuresResult> {
  const report = await readJson<PlaywrightJsonReport>(
    path.join(input.latestDir, 'playwright.json'),
  );
  const existingRaw = await readJson<unknown>(
    path.join(input.latestDir, 'result.json'),
  ).catch(() => undefined);
  const existingParsed = TestResultSchema.safeParse(existingRaw);
  const existingResult = existingParsed.success ? existingParsed.data : undefined;

  if (!report) {
    return { failures: [], updatedResult: existingResult };
  }

  const parsed = parsePlaywrightJson(report);
  const failures: FailureEntry[] = [];

  for (const raw of parsed.rawFailures) {
    // 收集该失败的产物路径（按测试标题在 artifactDir 下查找）。
    const artifacts = await existingArtifacts(input.projectRoot, raw.artifacts);
    const entry = await input.client.analyzeFailure({
      testTitle: raw.test,
      errorMessage: raw.message,
      errorStack: raw.stack,
      artifacts,
    });
    failures.push(entry);
  }

  let updatedResult: TestResult | undefined;
  if (existingResult) {
    updatedResult = { ...existingResult, failures };
    await fs.writeFile(
      path.join(input.latestDir, 'result.json'),
      JSON.stringify(updatedResult, null, 2) + '\n',
      'utf8',
    );
    const reportsRoot = path.dirname(input.latestDir);
    await fs.writeFile(
      path.join(reportsRoot, 'runs', existingResult.runId, 'result.json'),
      JSON.stringify(updatedResult, null, 2) + '\n',
      'utf8',
    ).catch(() => undefined);
  }

  return { failures, updatedResult };
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}

/** 在 artifactDir 下按测试标题关键词查找截图/trace/video。 */
async function existingArtifacts(
  baseDirectory: string,
  artifacts?: { screenshot?: string; trace?: string; video?: string },
): Promise<typeof artifacts> {
  if (!artifacts) return undefined;
  const pairs = await Promise.all(Object.entries(artifacts).map(async ([key, value]) => [
    key,
    value && await fs.access(path.resolve(baseDirectory, value))
      .then(() => path.resolve(baseDirectory, value)).catch(() => undefined),
  ] as const));
  const result = Object.fromEntries(pairs.filter(([, value]) => value));
  return Object.keys(result).length > 0 ? result : undefined;
}
