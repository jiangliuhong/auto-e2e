# Runtime 规范

本文档定义了 auto-e2e Runtime 稳定的公共契约。

CLI 可能会随时间变化,但 Runtime API 应尽可能保持稳定。

---

## 核心 Runtime 接口

```ts
export interface AutoE2ERuntime {
  prepare(options?: PrepareOptions): Promise<PrepareResult>

  cleanup(options?: CleanupOptions): Promise<CleanupResult>

  scan(options?: ScanOptions): Promise<ScanResult>

  observe(options: ObserveOptions): Promise<ObservationResult>

  run(options?: RunOptions): Promise<RunResult>

  report(options?: ReportOptions): Promise<ReportResult>

  doctor(options?: DoctorOptions): Promise<DoctorResult>
}
```

---

## prepare()

负责准备执行环境。

典型职责:

- 安装或验证依赖
- 如果已配置,则启动 dev server
- 等待直到 baseUrl 就绪
- 创建 `.auto-e2e/`
- 启用时初始化存储状态

该方法必须是幂等的。

---

## cleanup()

负责停止受管的资源。

典型职责:

- 停止受管的 dev server
- 刷新运行时日志
- 关闭浏览器上下文

除非被显式要求,该方法不得删除 `.auto-e2e/` 历史。

---

## scan()

负责扫描项目。

应当产出:

- `.auto-e2e/app-map.json`
- `.auto-e2e/selector-map.json`
- `.auto-e2e/codex-context.md`

Scanner 不得执行应用代码。

---

## observe()

负责观察单个 URL 或路由。

```ts
export interface ObserveOptions {
  url: string
  viewport?: Viewport
  storageState?: string
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
  timeoutMs?: number
  outputDir?: string
}
```

必须产出结构化输出。

```ts
export interface ObservationResult {
  id: string
  url: string
  finalUrl: string
  title: string
  status?: number
  screenshot?: ArtifactRef
  domSnapshot?: ArtifactRef
  accessibilityTree?: unknown
  elements: ObservedElement[]
  consoleMessages: ConsoleMessageRecord[]
  networkRequests: NetworkRequestRecord[]
  recommendedSelectors: RecommendedSelector[]
  errors: RuntimeError[]
  createdAt: string
}
```

观察不是测试。

它不得做断言。

---

## run()

负责执行 Playwright 测试。

```ts
export interface RunOptions {
  spec?: string
  suite?: string
  tag?: string
  headed?: boolean
  browser?: 'chromium' | 'firefox' | 'webkit'
  updateSnapshots?: boolean
  retries?: number
}
```

必须产出:

- `.auto-e2e/run-result.json`
- Playwright 报告产物
- trace 引用
- 截图引用
- 在可用时提供视频引用

---

## report()

负责把原始测试输出转换为 Agent 可读的反馈。

必须产出:

- `.auto-e2e/failure-summary.md`
- `.auto-e2e/run-result.json`

报告应包括:

- 失败的测试
- 文件和行号信息
- 错误信息
- 控制台错误
- 网络错误
- 产物路径
- 建议下一步检查的目标

Runtime 可以提供启发式建议,但不得表现得像一个 LLM。

---

## doctor()

负责检查项目是否能够运行 auto-e2e。

检查应包括:

- Node 版本
- 包管理器
- Playwright 安装
- 浏览器安装
- 配置有效性
- 在配置了 baseUrl 时检查其可达性
- 可写的 `.auto-e2e/`

---

## 错误模型

所有 Runtime 错误都应遵循稳定的结构。

```ts
export interface RuntimeError {
  code: string
  message: string
  cause?: string
  recoverable: boolean
  details?: Record<string, unknown>
}
```

避免从 provider 中抛出原始错误。

尽可能把它们转换为 RuntimeError。
