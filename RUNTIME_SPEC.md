# Runtime Specification

This document defines the stable public contract of the auto-e2e Runtime.

The CLI may change over time, but Runtime APIs should remain stable whenever possible.

---

## Core Runtime Interface

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

Responsible for preparing the execution environment.

Typical responsibilities:

- install or verify dependencies
- start dev server if configured
- wait until baseUrl is ready
- create `.auto-e2e/`
- initialize storage state when enabled

The method must be idempotent.

---

## cleanup()

Responsible for stopping managed resources.

Typical responsibilities:

- stop managed dev server
- flush runtime logs
- close browser context

The method must not delete `.auto-e2e/` history unless explicitly requested.

---

## scan()

Responsible for scanning the project.

Should produce:

- `.auto-e2e/app-map.json`
- `.auto-e2e/selector-map.json`
- `.auto-e2e/codex-context.md`

Scanner must not execute application code.

---

## observe()

Responsible for observing a single URL or route.

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

Must produce structured output.

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

Observation is not a test.

It must not make assertions.

---

## run()

Responsible for executing Playwright tests.

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

Must produce:

- `.auto-e2e/run-result.json`
- Playwright report artifacts
- trace references
- screenshot references
- video references when available

---

## report()

Responsible for transforming raw test output into Agent-readable feedback.

Must produce:

- `.auto-e2e/failure-summary.md`
- `.auto-e2e/run-result.json`

Report should include:

- failed tests
- file and line information
- error message
- console errors
- network errors
- artifact paths
- suggested next inspection targets

The Runtime may provide heuristic suggestions, but must not act like an LLM.

---

## doctor()

Responsible for checking whether the project can run auto-e2e.

Checks should include:

- Node version
- package manager
- Playwright installation
- browser installation
- config validity
- baseUrl reachability when configured
- writable `.auto-e2e/`

---

## Error Model

All Runtime errors should follow a stable structure.

```ts
export interface RuntimeError {
  code: string
  message: string
  cause?: string
  recoverable: boolean
  details?: Record<string, unknown>
}
```

Avoid throwing raw errors from providers.

Convert them into RuntimeError whenever possible.
