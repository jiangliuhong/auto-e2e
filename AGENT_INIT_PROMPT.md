# AGENT_INIT_PROMPT.md

# Project Goal

Build **auto-e2e**, an **Agent Runtime for Playwright**.

This project is not tied to any specific Coding Agent.

It should work well with:

* Codex
* Claude Code
* Cursor
* OpenCode
* GitHub Copilot Coding Agent
* Any future Coding Agent

The Runtime should provide a stable, deterministic, structured environment for browser E2E automation.

---

# Core Concept

The external Coding Agent is responsible for reasoning.

The Runtime is responsible for:

* Environment
* Observation
* Execution
* Feedback
* Storage

The Runtime must never depend on a specific LLM provider or Coding Agent.

---

# What This Project Is

auto-e2e is:

* A Playwright Runtime
* A browser observation framework
* A structured E2E execution layer
* A machine-readable feedback generator
* A tool that helps Coding Agents write, run, and fix E2E tests

---

# What This Project Is Not

auto-e2e is not:

* An AI Agent
* A test generation model
* A Codex-only tool
* A Claude-only tool
* A wrapper around one specific assistant
* A tool that calls OpenAI, Anthropic, or any LLM by default

---

# Required Tech Stack

Use:

* Node.js >= 20
* TypeScript
* ESM
* pnpm
* Commander.js
* Playwright
* execa
* fs-extra
* zod
* fast-glob

---

# Architecture

Use a Runtime-first architecture.

Suggested structure:

```text
src/
  cli/
  runtime/
    environment/
    observer/
    executor/
    feedback/
    storage/
  scanner/
  reporter/
  playwright/
  core/
  utils/
```

CLI must only call Runtime APIs.

Do not put business logic in CLI commands.

---

# Runtime Modules

## Environment

Responsible for:

* Starting app
* Stopping app
* Restarting app
* Waiting for app readiness
* Health checks
* Storage state
* Fixtures

## Observer

Responsible for:

* Opening pages
* Collecting DOM snapshot
* Collecting accessibility tree
* Collecting title and URL
* Collecting buttons, inputs, links, tables, dialogs
* Collecting console messages
* Collecting network requests
* Taking screenshots
* Recommending selectors

Observer must not execute test assertions.

## Executor

Responsible for:

* Running Playwright tests
* Running all tests
* Running one spec
* Running by tag or suite
* Collecting trace, screenshot, video, HTML report, JSON report

## Feedback

Responsible for:

* Parsing Playwright results
* Producing structured failure reports
* Producing Markdown summaries
* Extracting likely failure causes
* Linking screenshots and traces

## Storage

Responsible for all Runtime state under:

```text
.auto-e2e/
```

---

# CLI Commands

Implement these commands first:

```bash
auto-e2e init
auto-e2e scan
auto-e2e prepare
auto-e2e observe --url /login
auto-e2e run
auto-e2e run --spec e2e/specs/login.spec.ts
auto-e2e report
auto-e2e doctor
```

---

# Runtime Outputs

All generated Runtime files must be stored under:

```text
.auto-e2e/
```

Expected files:

```text
.auto-e2e/
  app-map.json
  selector-map.json
  codex-context.md
  agent-context.md
  run-result.json
  failure-summary.md
  observations/
  reports/
  history/
```

Prefer `agent-context.md` as the generic context file.

`codex-context.md` can be kept only as a backward-compatible alias.

---

# Agent Compatibility Rules

The Runtime should output information in formats that any Coding Agent can read:

* JSON
* Markdown
* plain text logs

Avoid formats that require a specific platform.

Do not assume the Agent has access to browser UI.

Do not assume the Agent can inspect screenshots visually.

Always provide structured text data when possible.

---

# Development Phases

## Phase 1

* Project setup
* CLI skeleton
* Runtime interfaces
* Storage layout
* Basic docs

## Phase 2

* Environment implementation
* Scanner implementation
* Config loading
* Project detection

## Phase 3

* Observer implementation
* DOM snapshot
* Accessibility snapshot
* Console collection
* Network collection
* Screenshot capture
* Selector recommendation

## Phase 4

* Executor implementation
* Playwright runner integration
* JSON report parsing
* Artifact collection

## Phase 5

* Feedback implementation
* failure-summary.md
* run-result.json
* Agent-friendly suggestions

## Phase 6

* Tests
* Examples
* Documentation
* Provider extension guide

---

# Coding Rules

Use strict TypeScript.

Avoid `any`.

Prefer interfaces.

Keep modules small.

Do not create large files.

Use dependency injection where helpful.

Program against abstractions, not concrete implementations.

Do not hardcode Playwright throughout the Runtime.

---

# Testing Rules

Add tests for each module.

Prefer deterministic tests.

Avoid arbitrary sleeps.

Avoid flaky browser tests.

Keep unit tests separate from E2E tests.

---

# Important Design Constraint

This Runtime must remain independent from all specific AI tools.

Do not name Codex, Claude, Cursor, or OpenCode in implementation-level APIs unless the feature is explicitly a compatibility adapter.

Use generic names:

* `agentContext`
* `agentPrompt`
* `agentReport`
* `runtimeResult`

Avoid tool-specific names:

* `codexContext`
* `claudeContext`
* `cursorReport`

---

# Final Goal

Build a long-term maintainable **Agent Runtime for E2E testing**.

The Runtime should make browser automation easier for any Coding Agent by providing:

* Stable environment control
* Rich page observation
* Deterministic test execution
* Structured feedback
* Persistent runtime state
