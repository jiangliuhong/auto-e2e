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

Create one file per independent scenario under `.auto-e2e/specs/`. File names must use descriptive kebab-case and end in `.spec.json`, for example `.auto-e2e/specs/order-search.spec.json`. Only files with this suffix are discovered.

```json
{
  "taskId": "optional-stable-id",
  "title": "P&L 预测",
  "requirement": "上传预测模板，执行锁定计算并核对结果。",
  "inputs": [
    { "name": "P&L 模板", "path": "fixtures/pl-forecast.xlsx" }
  ],
  "outputs": [
    {
      "name": "税前利润",
      "location": "预测结果汇总区",
      "expected": 125000.25,
      "match": "numeric",
      "tolerance": 0.01
    }
  ],
  "acceptanceCriteria": [
    "模板上传成功并完成锁定计算"
  ]
}
```

Required fields are `title`, `requirement`, and a non-empty `acceptanceCriteria` string array. `taskId`, `inputs`, and `outputs` are optional. Input `path` must be a relative path to a regular file inside the project; absolute paths, traversal, and symlinks escaping the project are blocked. Output `match` can be `equals`, `contains`, or `numeric`; numeric outputs may set a non-negative absolute `tolerance`. Each output becomes an additional mandatory acceptance criterion. Do not add `changedFiles`, implementation steps, selectors, or expected source-code changes.

For multiple scenarios, create multiple files instead of a `cases` array. `taskId` values must be unique across discovered files. When omitted, auto-e2e derives the ID from the file name. Do not create `.auto-e2e/task-spec.json`; it is not discovered.

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
