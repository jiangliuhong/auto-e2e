# Provider Guide

auto-e2e should be provider-based.

Providers allow the Runtime to evolve without rewriting core logic.

---

## Provider Principles

- Providers implement interfaces.
- Runtime depends on abstractions, not implementations.
- Providers must be replaceable.
- Providers must not call the CLI.
- Providers must not perform AI reasoning.

---

## BrowserProvider

Responsible for browser-level operations.

Initial implementation:

- PlaywrightBrowserProvider

Future implementations:

- RemoteBrowserProvider
- ChromeDevToolsProvider

Suggested interface:

```ts
export interface BrowserProvider {
  openPage(options: OpenPageOptions): Promise<BrowserPageHandle>
  close(): Promise<void>
}
```

---

## EnvironmentProvider

Responsible for application environment lifecycle.

Initial implementation:

- LocalNodeEnvironmentProvider

Future implementations:

- DockerEnvironmentProvider
- RemoteEnvironmentProvider

Suggested interface:

```ts
export interface EnvironmentProvider {
  prepare(options: PrepareOptions): Promise<PrepareResult>
  cleanup(options?: CleanupOptions): Promise<CleanupResult>
  healthCheck(options?: HealthCheckOptions): Promise<HealthCheckResult>
}
```

---

## ReportProvider

Responsible for reading and writing reports.

Initial implementations:

- JsonReportProvider
- MarkdownReportProvider

Future implementations:

- JUnitReportProvider
- HtmlReportProvider

Suggested interface:

```ts
export interface ReportProvider {
  write(result: RunResult | ObservationResult): Promise<ArtifactRef>
  read(path: string): Promise<unknown>
}
```

---

## ScannerProvider

Responsible for framework-specific project scanning.

Initial implementations:

- NextScannerProvider
- ReactViteScannerProvider
- VueViteScannerProvider

Suggested interface:

```ts
export interface ScannerProvider {
  detect(projectRoot: string): Promise<boolean>
  scan(projectRoot: string): Promise<Partial<AppMap>>
}
```

---

## SelectorProvider

Responsible for extracting and recommending selectors.

Initial implementation:

- StaticSelectorProvider
- PlaywrightSelectorProvider

Recommended selector priority:

1. role
2. label
3. placeholder
4. data-testid
5. stable text
6. CSS fallback

Avoid recommending:

- nth-child
- generated class names
- long CSS chains

---

## Adding a New Provider

When adding a provider:

1. Define or reuse an interface.
2. Implement the provider in its own folder.
3. Add unit tests.
4. Register it through provider configuration.
5. Update this document if the provider introduces a new contract.

Never modify Runtime core to hardcode a provider.
