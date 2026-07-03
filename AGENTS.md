# Auto E2E Development Rules

This repository is designed for Coding Agents.

Before making any change, read this document completely.

---

## Project Goal

Build an Agent Runtime for Playwright.

The Runtime is responsible for:

- Environment
- Observation
- Execution
- Feedback

The Runtime is not responsible for AI reasoning.

---

## Development Workflow

Always follow this workflow:

1. Understand the current architecture.
2. Keep module boundaries clear.
3. Implement one capability at a time.
4. Add tests.
5. Update documentation.

Do not mix multiple unrelated changes into one task.

---

## Architecture Rules

- Never bypass Runtime.
- Never place business logic inside CLI.
- Never tightly couple modules.
- Always program against interfaces.
- Prefer dependency injection.
- Providers must be replaceable.

---

## Directory Rules

CLI code belongs in:

```text
src/cli
```

Runtime belongs in:

```text
src/runtime
```

Shared models:

```text
src/core
```

Utilities:

```text
src/utils
```

Playwright integration:

```text
src/playwright
```

Project scanning:

```text
src/scanner
```

Reporting:

```text
src/reporter
```

Do not create large miscellaneous folders.

---

## Runtime Rules

- Environment manages environment only.
- Observer observes only.
- Executor executes only.
- Feedback analyzes execution results only.
- Storage persists runtime state only.

Keep responsibilities isolated.

---

## Coding Rules

- Use TypeScript strict mode.
- Avoid `any`.
- Prefer interface over concrete implementation.
- Use meaningful names.
- Keep files focused.
- Avoid deep inheritance.
- Prefer composition.

---

## Testing Rules

- Every new feature should include tests.
- Tests should be deterministic.
- Avoid flaky tests.
- Avoid unnecessary waits.
- Prefer explicit assertions.

---

## Playwright Rules

Prefer:

- `getByRole`
- `getByLabel`
- `getByPlaceholder`
- `data-testid`

Avoid:

- `nth-child`
- generated CSS class names
- long CSS selectors
- arbitrary timeout values

Use `storageState` whenever possible.

---

## Runtime Outputs

Runtime artifacts belong only in:

```text
.auto-e2e/
```

Expected outputs include:

- app-map.json
- selector-map.json
- codex-context.md
- run-result.json
- failure-summary.md
- observations/

Do not write runtime files elsewhere.

---

## Change Policy

When implementing a feature:

- Minimize the scope of changes.
- Reuse existing abstractions.
- Avoid breaking public interfaces.
- Preserve backward compatibility when practical.

Refactor only when it clearly improves maintainability.

---

## Agent Behaviour

Before writing code:

- Read `ARCHITECTURE.md`.
- Respect module boundaries.
- Search for existing abstractions before creating new ones.

Before finishing:

- Run tests.
- Check formatting.
- Verify TypeScript compilation.
- Update documentation if behavior changed.

---

## Long-Term Principles

Optimize for maintainability rather than speed.

Prefer extensibility over shortcuts.

The Runtime should remain independent from any specific AI model or coding assistant.

Every feature should make the Runtime more reusable, observable, and deterministic.
