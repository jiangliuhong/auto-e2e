# Provider 指南

auto-e2e 应当基于 provider。

Provider 让 Runtime 能够在不重写核心逻辑的情况下演进。

---

## Provider 原则

- Provider 实现接口。
- Runtime 依赖抽象,而非实现。
- Provider 必须可替换。
- Provider 不得调用 CLI。
- Provider 不得执行 AI 推理。

---

## BrowserProvider

负责浏览器级操作。

初始实现:

- PlaywrightBrowserProvider

未来实现:

- RemoteBrowserProvider
- ChromeDevToolsProvider

建议接口:

```ts
export interface BrowserProvider {
  openPage(options: OpenPageOptions): Promise<BrowserPageHandle>
  close(): Promise<void>
}
```

---

## EnvironmentProvider

负责应用环境的生命周期。

初始实现:

- LocalNodeEnvironmentProvider

未来实现:

- DockerEnvironmentProvider
- RemoteEnvironmentProvider

建议接口:

```ts
export interface EnvironmentProvider {
  prepare(options: PrepareOptions): Promise<PrepareResult>
  cleanup(options?: CleanupOptions): Promise<CleanupResult>
  healthCheck(options?: HealthCheckOptions): Promise<HealthCheckResult>
}
```

---

## ReportProvider

负责报告的读写。

初始实现:

- JsonReportProvider
- MarkdownReportProvider

未来实现:

- JUnitReportProvider
- HtmlReportProvider

建议接口:

```ts
export interface ReportProvider {
  write(result: RunResult | ObservationResult): Promise<ArtifactRef>
  read(path: string): Promise<unknown>
}
```

---

## ScannerProvider

负责框架特定的项目扫描。

初始实现:

- NextScannerProvider
- ReactViteScannerProvider
- VueViteScannerProvider

建议接口:

```ts
export interface ScannerProvider {
  detect(projectRoot: string): Promise<boolean>
  scan(projectRoot: string): Promise<Partial<AppMap>>
}
```

---

## SelectorProvider

负责提取和推荐选择器。

初始实现:

- StaticSelectorProvider
- PlaywrightSelectorProvider

推荐的选择器优先级:

1. role
2. label
3. placeholder
4. data-testid
5. 稳定的文本
6. CSS 兜底

避免推荐:

- nth-child
- 生成的类名
- 过长的 CSS 链

---

## 添加新 Provider

添加 provider 时:

1. 定义或复用一个接口。
2. 在各自的文件夹中实现该 provider。
3. 添加单元测试。
4. 通过 provider 配置进行注册。
5. 如果该 provider 引入了新的契约,更新本文档。

绝不要修改 Runtime 核心来硬编码某个 provider。
