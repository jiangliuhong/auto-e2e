---
name: auto-e2e-acceptance
description: Prepare an application workspace for auto-e2e acceptance, create or update its configuration and task specification from a requirement, run BetterWright-backed verification, and interpret proof-backed results. Use when Codex is asked to configure auto-e2e, author acceptance criteria, run acceptance from the CLI, or prepare a workspace for the auto-e2e Web UI.
---

# Auto-e2e Acceptance

Use auto-e2e to verify the requested behavior in the target application. Do not use it to modify application behavior unless the user separately asks for implementation changes.

## Workflow

1. Resolve the target workspace root. Inspect the requirement and relevant product behavior.
2. Read [references/contracts.md](references/contracts.md) before creating files or interpreting a run. When creating, updating, or regenerating a spec, also read and follow [references/authoring-review.md](references/authoring-review.md).
3. Create or update `.auto-e2e/config.yaml` only when configuration is missing or the requested target differs. If only the legacy `.auto-e2e.yaml` exists, update that file instead; when both exist, use the new file without merging. Omit default storage paths so generated config stays portable. Never store passwords, tokens, cookies, or session data in it.
4. Establish the authority order among the user's instructions, project-declared authoritative sources, requirements, design, test plans, implementation observations, and existing specs. Treat existing specs and their support files as candidates to audit, never as the default source of truth. Resolve or report contradictions before encoding an expected result.
5. Create one `.auto-e2e/specs/<name>/spec.json` bundle per independent scenario. Keep authored files under its `inputs/` and `expected/` directories. Write business-level `steps` and atomic `results`; do not add Playwright-style actions, selectors, or implementation details. Steps are evaluated in declaration order, but a failed or blocked step does not automatically stop unrelated, read-only later steps. Use `skipped` only when a later step truly depends on an earlier failed or blocked step. Keep independently executable checks in separate steps or bundles instead of inventing an all-or-nothing dependency chain.
6. Before delivery, perform the source-consistency and execution-feasibility gate from the authoring review. Do not call a spec ready when an expected result contradicts an authoritative source, depends on unavailable evidence, combines unrelated assertions, or requires profiles or environments the run cannot supply.
7. When execution is part of the request, run `auto-e2e --project-root <workspace> doctor --json`, then `auto-e2e --project-root <workspace> run --json`. For an authoring-only request, do not start BetterWright; report the static validation performed and the runtime prerequisites still needed.
8. Treat the run as complete only when its status is `passed` and every case and criterion passed. For `failed` or `blocked`, report the affected case, failed criterion, actual observation, and proof or actionable blocker. Do not claim success merely because the command launched.

The same files are editable and runnable in the Web UI. Start it with `auto-e2e serve --workspace <workspace> --open` when the user asks for an interactive workflow.

Preserve user-authored acceptance criteria only after confirming that they remain relevant and agree with the selected authoritative source. Correct or remove stale and contradictory criteria instead of carrying them into a regenerated spec. Remove obsolete fields instead of maintaining compatibility with legacy task formats.
