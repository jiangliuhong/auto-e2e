/**
 * 变更分析：把 Git 变更文件归纳为结构化的变更概要（plan §16 阶段三）。
 *
 * 不调用 AI，只做基于规则的路由/文件分类，供 Pi 需求分析阶段作为输入。
 */
import type { ChangedFiles } from './git-diff-reader.js';

export interface ChangeSummary {
  /** 变更文件总数。 */
  fileCount: number;
  /** 按目录前缀分组的文件。 */
  byDirectory: Record<string, string[]>;
  /** 推断变更的前端路由文件（pages/、app/、routes/ 等）。 */
  routeFiles: string[];
  /** 推断变更的 API/接口文件（api/、server/、controllers/ 等）。 */
  apiFiles: string[];
  /** 推断变更的组件文件。 */
  componentFiles: string[];
}

const ROUTE_HINTS = [/\/pages?\//, /\/app\//, /\/routes?\//, /\/views?\//];
const API_HINTS = [/\/api\//, /\/server\//, /\/controllers?\//, /\/services?\//];
const COMPONENT_HINTS = [/\/components?\//, /\/features?\//];

function matchesAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(path));
}

export function analyzeChanges(changes: ChangedFiles): ChangeSummary {
  const byDirectory: Record<string, string[]> = {};
  const routeFiles: string[] = [];
  const apiFiles: string[] = [];
  const componentFiles: string[] = [];

  for (const file of changes.files) {
    const topDir = file.split('/')[0] ?? '(root)';
    (byDirectory[topDir] ??= []).push(file);

    if (matchesAny(file, ROUTE_HINTS)) routeFiles.push(file);
    if (matchesAny(file, API_HINTS)) apiFiles.push(file);
    if (matchesAny(file, COMPONENT_HINTS)) componentFiles.push(file);
  }

  return {
    fileCount: changes.files.length,
    byDirectory,
    routeFiles,
    apiFiles,
    componentFiles,
  };
}
