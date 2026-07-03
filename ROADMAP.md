# Roadmap

## Phase 1 — Project Foundation

Goal: establish architecture, CLI, interfaces, and storage.

Deliverables:

- TypeScript project setup
- Commander.js CLI
- ESM configuration
- Runtime interfaces
- `.auto-e2e/` storage service
- init command
- doctor command

Commands:

```bash
auto-e2e init
auto-e2e doctor
```

---

## Phase 2 — Scanner

Goal: discover project structure.

Deliverables:

- package manager detection
- framework detection
- route scanning
- data-testid scanning
- app-map.json
- selector-map.json
- codex-context.md

Command:

```bash
auto-e2e scan
```

---

## Phase 3 — Environment

Goal: prepare local app environment.

Deliverables:

- dev server start
- readiness probe
- port check
- cleanup
- storageState placeholder

Command:

```bash
auto-e2e prepare
```

---

## Phase 4 — Observer

Goal: make browser pages visible to Agents through structured output.

Deliverables:

- observe URL
- screenshot
- DOM snapshot
- console capture
- network capture
- element extraction
- recommended selector generation

Command:

```bash
auto-e2e observe --url /login
```

---

## Phase 5 — Executor

Goal: run Playwright through Runtime.

Deliverables:

- run all specs
- run specific spec
- collect JSON report
- collect trace/screenshot/video refs

Commands:

```bash
auto-e2e run
auto-e2e run --spec e2e/specs/login.spec.ts
```

---

## Phase 6 — Feedback

Goal: turn execution results into Agent-readable feedback.

Deliverables:

- run-result.json
- failure-summary.md
- failed test extraction
- artifact path extraction
- console/network error summary

Command:

```bash
auto-e2e report
```

---

## Phase 7 — Stabilization

Goal: improve reliability and developer experience.

Deliverables:

- tests for each module
- documentation updates
- example projects
- CI workflow
- npm package publishing setup

---

## Phase 8 — Advanced Runtime

Possible future capabilities:

- Docker environment provider
- Remote browser provider
- MCP server mode
- accessibility testing
- visual regression
- network mocking
- test data fixtures
- CI summary reporter
