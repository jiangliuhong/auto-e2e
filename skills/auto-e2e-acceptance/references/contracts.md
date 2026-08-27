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

Create `.auto-e2e/task-spec.json`. This is a strict schema; legacy fields are rejected.

```json
{
  "taskId": "optional-stable-id",
  "title": "用户可搜索订单",
  "requirement": "登录用户可以按订单号查找自己的订单。",
  "acceptanceCriteria": [
    "输入存在的订单号并搜索后，结果列表显示该订单号",
    "输入不存在的订单号并搜索后，页面显示空结果提示"
  ]
}
```

Required fields are `title`, `requirement`, and a non-empty `acceptanceCriteria` string array. `taskId` is optional. Do not add `changedFiles`, implementation steps, selectors, or expected source-code changes.

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
