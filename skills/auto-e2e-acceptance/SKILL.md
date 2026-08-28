---
name: auto-e2e-acceptance
description: Prepare an application workspace for auto-e2e acceptance, create or update its configuration and task specification from a requirement, run BetterWright-backed verification, and interpret proof-backed results. Use when Codex is asked to configure auto-e2e, author acceptance criteria, run acceptance from the CLI, or prepare a workspace for the auto-e2e Web UI.
---

# Auto-e2e Acceptance

Use auto-e2e to verify the requested behavior in the target application. Do not use it to modify application behavior unless the user separately asks for implementation changes.

## Workflow

1. Resolve the target workspace root. Inspect the requirement, relevant product behavior, and an OpenSpec change when the user names one.
2. Read [references/contracts.md](references/contracts.md) before creating files or interpreting a run.
3. Create or update `.auto-e2e.yaml` only when configuration is missing or the requested target differs. Never store passwords, tokens, cookies, or session data in it.
4. Create one `.auto-e2e/specs/<name>.spec.json` file per independent scenario. Use descriptive kebab-case file names, and never combine multiple cases into one JSON file. Make every acceptance criterion atomic, observable in the product, and independent of implementation details. When a scenario uploads a local template, declare it in `inputs`; when exact page results matter, declare them in `outputs` rather than leaving expected values only in prose.
5. Run `auto-e2e --project-root <workspace> doctor --json`, then `auto-e2e --project-root <workspace> run --json`.
6. Treat the run as complete only when its status is `passed` and every case and criterion passed. For `failed` or `blocked`, report the affected case, failed criterion, actual observation, and proof or actionable blocker. Do not claim success merely because the command launched.

The same files are editable and runnable in the Web UI. Start it with `auto-e2e serve --workspace <workspace> --open` when the user asks for an interactive workflow.

Preserve user-authored acceptance criteria that remain relevant. Remove obsolete fields instead of maintaining compatibility with legacy task formats.
