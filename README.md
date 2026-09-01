# auto-e2e

基于 BetterWright 的本地需求验收运行器。它读取明确的需求与验收标准，驱动真实浏览器逐条验证，保存 proof 截图，并通过 SQLite 与本地 Web 服务提供可追溯历史。

auto-e2e 不生成 Playwright 测试，不调用 Pi SDK，也不修改被测应用代码。

## 安装

要求 Node.js >= 22.18.0。

```bash
npm install
npm run build
npm link
auto-e2e doctor
auto-e2e skill install # 安装到当前项目 .codex/skills
```

## 配置

项目根目录可创建 `.auto-e2e.yaml`：

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

凭据、Cookie 和 Token 不得写入配置；登录状态由 BetterWright Profile 管理。

## 使用

```bash
# 检查工具链和当前项目
auto-e2e doctor

# 仅检查其中一类（两个选项互斥）
auto-e2e doctor --tool
auto-e2e doctor --project

# 默认按路径顺序运行 .auto-e2e/specs/**/spec.json
auto-e2e run --json

# 查询历史
auto-e2e list
auto-e2e show <run-id> --json

# 本地工作区与验收服务
auto-e2e serve --workspace /path/to/my-web --port 4317 --open

# 检查当前项目的 Codex 验收 Skill
auto-e2e skill status
```

Web UI 维护独立的工作区列表。选中工作区后，可以新建、切换、编辑和删除 `.auto-e2e/specs/<name>/spec.json` 用例包，发起验收并查看历史、步骤、结果与 proof。

需要人工登录、扫码、MFA 或 Passkey 时，在“执行验收”页面确认目标 URL 与 Profile，点击“打开手动登录”。页面会打开 BetterWright 的本机可交互浏览器；完成登录后直接关闭该标签页或返回 auto-e2e，后续验收会复用同一 Profile 的登录状态。Live View 控制地址属于临时敏感信息，不会写入配置、历史或报告。

每个目录只描述一个用例。例如 `.auto-e2e/specs/order-search/spec.json`：

```json
{
  "schemaVersion": 2,
  "taskId": "ORDER-01",
  "title": "查询已有订单",
  "requirement": "用户按订单号查询已有订单",
  "steps": [{
    "id": "STEP-01",
    "instruction": "按订单号查询已有订单",
    "expected": "查询完成并显示结果"
  }],
  "results": [{
    "id": "RESULT-01",
    "name": "订单号",
    "actual": "查询结果中的订单号",
    "expected": "ORDER-001",
    "match": "equals"
  }]
}
```

需要文件时，将 spec、输入和预期结果放在同一个 bundle：

```text
.auto-e2e/specs/pl-forecast/
├── spec.json
├── inputs/pl-forecast.xlsx
└── expected/result.xlsx
```

```json
{
  "schemaVersion": 2,
  "taskId": "PL-FORECAST-01",
  "title": "P&L 预测",
  "requirement": "上传预测模板并执行锁定计算",
  "files": [
    { "id": "input", "role": "input", "path": "inputs/pl-forecast.xlsx" },
    { "id": "expected", "role": "expected", "path": "expected/result.xlsx" }
  ],
  "steps": [{
    "id": "STEP-01",
    "instruction": "上传模板并完成锁定计算",
    "uses": ["input"],
    "expected": "锁定成功"
  }],
  "results": [{
    "id": "RESULT-01",
    "name": "锁定结果",
    "actual": "页面锁定结果表格",
    "expected": { "file": "expected", "sheet": "锁定结果" },
    "match": "table"
  }]
}
```

文件路径相对于 bundle，且不能逃逸该目录。运行时文件会临时复制到 BetterWright artifact 区，结束后删除。业务步骤保持语义化；`equals`、`contains`、`numeric` 由运行器复算，复杂文件比较由执行器提供 proof。

默认运行会扫描目录中的所有匹配文件，忽略其他 JSON。每个文件使用独立 BetterWright session 依次运行，最终保存一条包含用例汇总、逐用例 AC 和 proof 的报告。

随包提供的 `auto-e2e-acceptance` Codex Skill 会根据需求创建 `.auto-e2e.yaml` 与原生 Spec Bundle。auto-e2e 正式运行只读取自己的 spec，不依赖 OpenSpec 或其他需求格式。

## 产物

```text
.auto-e2e/
├── specs/
│   ├── order-search/spec.json
│   └── pl-forecast/
│       ├── spec.json
│       ├── inputs/
│       └── expected/
├── history.sqlite
├── artifacts/<runId>/<caseId>/
└── reports/acceptance/
    ├── latest/result.json
    └── runs/<runId>/result.json
```

SQLite 保存需求、运行、逐条 AC 和 artifact 元数据；图片保存在文件系统。

## 退出码

| Code | 含义 |
|---|---|
| 0 | 全部通过 |
| 1 | 存在验收失败 |
| 2 | 环境、配置、登录或浏览器阻塞 |
| 3 | 工具自身异常 |

## 开发验证

```bash
npm run typecheck
npm test
npm run build
```
