# auto-e2e file and result contracts

## Project configuration

Create `.auto-e2e.yaml` in the workspace root:

```yaml
project:
  name: my-web
  baseUrl: https://test.example.com

acceptance:
  model: gpt-5.6-sol
  profile: my-web-test
  headed: false
  databasePath: .auto-e2e/history.sqlite
  forbiddenActions:
    - 删除数据
    - 发布或部署
    - 发起付款或购买
    - 向外部人员发送消息

report:
  outputDirectory: .auto-e2e/reports
  artifactDirectory: .auto-e2e/artifacts
```

`project.name` and `project.baseUrl` are required. Other values have defaults. Do not include credentials.

## Task specification

Create one self-contained `.auto-e2e/specs/<name>/spec.json` bundle per independent scenario. Paths in `files` are resolved from the bundle directory and may not escape it.

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
  "steps": [{
    "id": "STEP-01",
    "instruction": "上传预测输入文件并完成试算和锁定",
    "uses": ["forecast-input"],
    "expected": "锁定成功，状态显示为已锁定"
  }],
  "results": [{
    "id": "RESULT-01",
    "name": "锁定结果",
    "actual": "页面锁定结果表格",
    "expected": { "file": "expected-result", "sheet": "锁定结果" },
    "match": "table"
  }]
}
```

Required fields are `schemaVersion`, `taskId`, `title`, `requirement`, non-empty `steps`, and non-empty `results`. A step is a business intention, not a Playwright action. File roles are `input`, `expected`, and `reference`; every declared file must be used. Files are limited to 100 MiB each and 500 MiB per bundle. Scalar matches are `equals`, `contains`, and `numeric`; `visual`, `table`, and `file` are executor comparisons. Never store credentials, selectors, or production-sensitive data in a bundle.

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

Inspect the structured `status`, `criteria`, `actual`, `proof`, and `error` fields. A run without executed criteria or without a valid structured result is not a pass.
