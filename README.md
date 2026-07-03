# Auto E2E Documentation Pack

This documentation pack is designed for building **auto-e2e**, an Agent Runtime for Playwright.

The goal of this project is not to build an AI agent, but to build a deterministic runtime layer that Coding Agents such as Codex, Claude Code, Cursor, and OpenCode can use to observe, execute, and analyze E2E tests.

## Documents

- `CODEX_INIT_PROMPT.md` — Prompt for initializing the project with Codex.
- `ARCHITECTURE.md` — Runtime architecture and module responsibilities.
- `AGENTS.md` — Development rules for Coding Agents.
- `RUNTIME_SPEC.md` — Public Runtime API contract.
- `PROVIDER_GUIDE.md` — Provider extension guide.
- `OUTPUT_SPEC.md` — Runtime output file formats.
- `ROADMAP.md` — Suggested phased implementation roadmap.

## Core Idea

```text
External Coding Agent
        ↓
auto-e2e Runtime
        ↓
Playwright / Browser / Project Environment
```

The Agent thinks.

The Runtime observes, executes, and reports.
