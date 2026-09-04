# auto-e2e file and result contracts

## Project configuration

Create `.auto-e2e/config.yaml` under the workspace root (create its parent directory if needed):

```yaml
project:
  name: my-web
  baseUrl: https://test.example.com

acceptance:
  model: gpt-5.6-terra
  profile: my-web-test
  headed: false
  forbiddenActions:
    - 删除数据
    - 发布或部署
    - 发起付款或购买
    - 向外部人员发送消息
```

`project.name` and `project.baseUrl` are required. Other values have defaults. Do not include credentials.

Configuration priority is explicit `--config` > `.auto-e2e/config.yaml` > legacy `.auto-e2e.yaml`. Relative configuration paths resolve from the workspace root, not from the config directory.

Omit `acceptance.databasePath`, `report.outputDirectory`, and `report.artifactDirectory` unless a custom location is required. Run data defaults to `~/.auto-e2e/projects/<workspaceId>/` (database, reports, artifacts); `AUTO_E2E_HOME` overrides the user root. Explicit storage paths win. Without that environment override, existing project-local run data keeps the whole legacy layout. Config, specs and coverage review records belong in Git; runtime data does not.

## Task specification

Create one self-contained `.auto-e2e/specs/<name>/spec.json` bundle per independent scenario. Paths in `files` are resolved from the bundle directory and may not escape it.

```text
.auto-e2e/specs/pl-forecast/
├── spec.json
├── inputs/forecast.xlsx
└── expected/result.xlsx
```

```json
{
  "schemaVersion": 2,
  "taskId": "PL-FORECAST-01",
  "title": "P&L 预测",
  "requirement": "上传预测模板，执行锁定计算并核对结果。",
  "files": [
    { "id": "forecast-input", "role": "input", "path": "inputs/forecast.xlsx" },
    { "id": "expected-result", "role": "expected", "path": "expected/result.xlsx" }
  ],
  "steps": [
    {
      "id": "STEP-01",
      "instruction": "上传预测输入文件并完成试算和锁定",
      "uses": ["forecast-input"],
      "expected": "锁定成功，状态显示为已锁定"
    }
  ],
  "results": [
    {
      "id": "RESULT-01",
      "name": "锁定结果",
      "actual": "页面锁定结果表格",
      "expected": { "file": "expected-result", "sheet": "锁定结果" },
      "match": "table"
    }
  ]
}
```

Required fields are `schemaVersion`, `taskId`, `title`, `requirement`, non-empty `steps`, and non-empty `results`. A step is a business intention, not a Playwright action. File roles are `input`, `expected`, and `reference`; every declared file must be used. Files are limited to 100 MiB each and 500 MiB per bundle. Scalar matches are `equals`, `contains`, and `numeric`; `visual`, `table`, and `file` are executor comparisons. Never store credentials, selectors, or production-sensitive data in a bundle.

Steps are reported in declaration order. Their statuses mean:

- `passed`: the step ran and its expected observable state was reached.
- `failed`: the step ran, but its expected observable state was not reached.
- `blocked`: the step could not run or finish because a required capability, session, datum, or page state was unavailable.
- `skipped`: the step was not attempted because it actually depends on an earlier failed or blocked step.

A failed or blocked step does not automatically skip every later step. Continue with later steps that are independent, safe, and still executable, and preserve their observations. Results that remain observable may likewise be returned and evaluated; block only results whose required evidence is unavailable. A `skipped` step is invalid unless an earlier step failed or was blocked.

## Commands

```bash
auto-e2e --project-root <workspace> doctor --json
auto-e2e --project-root <workspace> run --json
auto-e2e serve --workspace <workspace> --open
```

The Web UI uses the same task specification and run pipeline as the CLI.

## Result interpretation

- Exit `0`: all acceptance criteria passed.
- Exit `1`: verification completed with at least one failed criterion.
- Exit `2`: environment, authentication, browser, or other execution blocker.
- Exit `3`: auto-e2e configuration or tool error.

Single-case results use schema version 1 and expose `criteria` directly. Suite results use schema version 2 and expose `cases`; inspect every case's `status`, `criteria`, `actual`, `proof`, and `error`. A run without executed criteria or without a valid structured result is not a pass.
