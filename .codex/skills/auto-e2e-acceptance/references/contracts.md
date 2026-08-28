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

Create one `.auto-e2e/specs/<name>.spec.json` file per independent scenario. This is a strict schema.

```json
{
  "taskId": "PL-FORECAST-01",
  "title": "P&L 预测",
  "requirement": "上传预测模板，执行锁定计算并核对结果。",
  "inputs": [{ "name": "P&L 模板", "path": "fixtures/pl-forecast.xlsx" }],
  "outputs": [{
    "name": "税前利润",
    "location": "预测结果汇总区",
    "expected": 125000.25,
    "match": "numeric",
    "tolerance": 0.01
  }],
  "acceptanceCriteria": [
    "模板上传成功并完成锁定计算"
  ]
}
```

Required fields are `title`, `requirement`, and a non-empty `acceptanceCriteria` string array. `taskId`, `inputs`, and `outputs` are optional. Input paths must be relative regular files inside the project. Output matching supports `equals`, `contains`, and `numeric`; numeric outputs may set a non-negative absolute `tolerance`. Each output becomes an additional mandatory acceptance criterion. Do not add `changedFiles`, implementation steps, selectors, or expected source-code changes.

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
