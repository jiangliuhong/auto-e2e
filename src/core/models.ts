// 共享领域模型。对齐 OUTPUT_SPEC.md 中各 JSON 示例的字段结构,
// 以及 RUNTIME_SPEC.md / PROVIDER_GUIDE.md 中提及的类型。
// 本文件仅包含类型,不含运行时逻辑。

/** 视口尺寸。 */
export interface Viewport {
  width: number
  height: number
}

/**
 * 指向 `.auto-e2e/` 内产物文件的引用。
 * path 总是相对 `.auto-e2e/` 或项目根的路径字符串。
 */
export interface ArtifactRef {
  path: string
  /** 产物类型,例如 `screenshot` / `dom` / `trace` / `video`。 */
  kind?: string
}

/** 检测到的项目框架。 */
export type Framework = 'nextjs' | 'react-vite' | 'vue-vite' | 'unknown'

/** 检测到的包管理器。 */
export type PackageManager = 'pnpm' | 'npm' | 'yarn'

/** Playwright 相关的项目配置。 */
export interface PlaywrightInfo {
  configFile?: string
  testDir?: string
}

/** app-map.json:描述发现的项目结构。对齐 OUTPUT_SPEC.md。 */
export interface AppMap {
  framework: Framework
  packageManager: PackageManager
  scripts: Record<string, string>
  routes: AppRoute[]
  apiRoutes: AppRoute[]
  playwright?: PlaywrightInfo
}

/** 一条路由。 */
export interface AppRoute {
  path: string
  source: string
}

/** selector-map.json 中的一项。对齐 OUTPUT_SPEC.md。 */
export interface SelectorItem {
  source: string
  kind: 'data-testid' | 'role' | 'label' | 'placeholder' | 'text' | 'css'
  value: string
  confidence: number
}

/** selector-map.json。 */
export interface SelectorMap {
  items: SelectorItem[]
}

// --- Observation 相关(对齐 RUNTIME_SPEC.md / OUTPUT_SPEC.md) ---

export interface ObservedElement {
  kind: string
  text?: string
  role?: string
  recommendedSelector: string
}

export interface RecommendedSelector {
  selector: string
  /** 推荐所依据的定位策略,例如 `role` / `label` / `data-testid`。 */
  strategy: string
  confidence: number
}

export interface ConsoleMessageRecord {
  type: 'log' | 'info' | 'warning' | 'error' | 'debug'
  text: string
  url?: string
  lineNumber?: number
}

export interface NetworkRequestRecord {
  url: string
  method: string
  status?: number
  resourceType?: string
  failed?: boolean
  failureText?: string
}

// --- Run 结果相关(对齐 OUTPUT_SPEC.md run-result.json) ---

export interface RunSummary {
  total: number
  passed: number
  failed: number
  skipped: number
}

export interface RunFailure {
  title: string
  file: string
  line?: number
  message: string
  artifacts?: {
    screenshot?: string
    trace?: string
  }
}

/** config.json:用户可编辑的 auto-e2e 配置。 */
export interface Config {
  /** 应用根 URL,例如 http://localhost:3000。 */
  baseUrl?: string
  /** dev server 启动命令,留空则按包管理器推导(`<pkg> run dev`)。 */
  devCommand?: string
  /** Playwright 配置文件路径,默认 playwright.config.ts。 */
  playwrightConfig?: string
  /** 默认浏览器。 */
  browser?: 'chromium' | 'firefox' | 'webkit'
  /** 默认视口。 */
  viewport?: Viewport
  /** storageState 文件路径(相对项目根)。 */
  storageState?: string
}
