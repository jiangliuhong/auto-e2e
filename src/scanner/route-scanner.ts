// 路由扫描。
// 当前支持 Next.js 的 app router 与 pages router。
// 非 Next 项目返回空数组(文件路由启发留待后续阶段)。
// 不执行应用代码,纯文件分析。

import path from 'node:path'
import fg from 'fast-glob'
import type { AppRoute } from '../core/models.js'

/**
 * 扫描 Next.js 路由(app router + pages router)。
 * @param projectRoot 项目根
 * @param srcDirs 候选源码根(默认 ['src', '.'])
 */
export async function scanNextRoutes(
  projectRoot: string,
  srcDirs: string[] = ['src', '.'],
): Promise<{ routes: AppRoute[]; apiRoutes: AppRoute[] }> {
  const routes: AppRoute[] = []
  const apiRoutes: AppRoute[] = []
  const seen = new Set<string>()

  for (const src of srcDirs) {
    const base = path.join(projectRoot, src)

    // app router: <base>/app/**/page.{tsx,ts,jsx,js} 与 route.{ts,js}
    // route.* 是 route handler,统一归入 apiRoutes。
    const appPages = await safeGlob('app/**/page.{tsx,ts,jsx,js}', base)
    const appRoutes = await safeGlob('app/**/route.{ts,js}', base)
    for (const file of appPages) {
      const computed = computeAppRoute(file, 'app', projectRoot)
      if (!computed) continue // 私有目录下的 page,跳过
      const { path: routePath, source } = computed
      if (!seen.has(routePath)) {
        seen.add(routePath)
        if (routePath.startsWith('/api')) {
          apiRoutes.push({ path: routePath, source })
        } else {
          routes.push({ path: routePath, source })
        }
      }
    }
    for (const file of appRoutes) {
      const computed = computeAppRoute(file, 'app', projectRoot)
      if (!computed) continue
      const { path: routePath, source } = computed
      const key = `route:${routePath}`
      if (!seen.has(key)) {
        seen.add(key)
        apiRoutes.push({ path: routePath, source })
      }
    }

    // pages router: <base>/pages/**/*.{tsx,ts,jsx,js}
    const pagesFiles = await safeGlob('pages/**/*.{tsx,ts,jsx,js}', base)
    for (const file of pagesFiles) {
      const routePath = pagesRoutePath(file, 'pages')
      const source = relativeSource(projectRoot, file)
      if (routePath === null) continue
      if (!seen.has(routePath)) {
        seen.add(routePath)
        if (routePath.startsWith('/api')) {
          apiRoutes.push({ path: routePath, source })
        } else {
          routes.push({ path: routePath, source })
        }
      }
    }
  }

  // 按路径排序,保证确定性。
  routes.sort((a, b) => a.path.localeCompare(b.path))
  apiRoutes.sort((a, b) => a.path.localeCompare(b.path))
  return { routes, apiRoutes }
}

/**
 * 把 app router 文件路径转换为路由路径。
 * 含私有目录(_xxx)的路由返回 null(跳过);路由组 (group) 被忽略但不影响路由合法性。
 */
function computeAppRoute(
  file: string,
  segment: string,
  projectRoot: string,
): { path: string; source: string } | null {
  // 找到 .../app/<rest>/page.tsx 中的 <rest>(去掉文件名)
  const segments = file.split('/')
  const idx = segments.indexOf(segment)
  const parts = segments.slice(idx + 1, -1)

  // 私有目录(_xxx)下的路由无效 → 跳过
  if (parts.some((p) => p.startsWith('_'))) return null

  const cleaned = parts
    .filter((p) => !(p.startsWith('(') && p.endsWith(')'))) // 忽略路由组 (group)
    .map((p) =>
      p
        .replace(/^\[\.\.\./, '*')
        .replace(/^\[/, ':')
        .replace(/\]$/, ''),
    ) // [slug]→:slug,[...x]→*x
  const routePath = cleaned.length === 0 ? '/' : '/' + cleaned.join('/')
  return { path: routePath, source: relativeSource(projectRoot, file) }
}

/** 把 pages router 文件路径转换为路由路径;index 与 _app/_document 等返回 null(非路由)。 */
function pagesRoutePath(file: string, segment: string): string | null {
  const idx = file.split('/').indexOf(segment)
  const parts = file.split('/').slice(idx + 1) // 含文件名
  const filename = parts[parts.length - 1] ?? ''
  const base = filename.replace(/\.(tsx|ts|jsx|js)$/, '')
  // 排除非路由文件
  if (['_app', '_document', '_error', '404', '500'].includes(base)) return null
  const dirs = parts.slice(0, -1)
  const cleaned = [...dirs, base === 'index' ? '' : base]
    .filter((p) => !p.startsWith('[') || true) // 保留动态路由原样(简化处理)
    .map((p) => p.replace(/^\[/, ':').replace(/\]$/, ''))
  const joined = cleaned.filter(Boolean).join('/')
  return joined === '' ? '/' : '/' + joined
}

function relativeSource(projectRoot: string, file: string): string {
  return path.relative(projectRoot, file).split(path.sep).join('/')
}

async function safeGlob(pattern: string, cwd: string): Promise<string[]> {
  try {
    return await fg(pattern, {
      cwd,
      absolute: true,
      onlyFiles: true,
      ignore: ['**/node_modules/**'],
    })
  } catch {
    return []
  }
}
