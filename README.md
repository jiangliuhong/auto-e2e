# auto-e2e

基于 BetterWright 的本地需求验收运行器。它读取明确的需求与验收标准，驱动真实浏览器逐条验证，保存 proof 截图，并通过 SQLite 与本地 Web 服务提供可追溯历史。

auto-e2e 不生成 Playwright 测试，不调用 Pi SDK，也不修改被测应用代码。

## 安装

要求 Node.js >= 22.13.0。

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
# 检查 BetterWright、浏览器和模型登录
auto-e2e doctor

# 默认按文件名顺序运行 .auto-e2e/specs/*.spec.json
auto-e2e run --json

# Markdown 需求
auto-e2e run --requirement ./requirement.md --url https://test.example.com

# OpenSpec change
auto-e2e run --change add-user-search --url https://test.example.com

# 查询历史
auto-e2e list
auto-e2e show <run-id> --json

# 本地工作区与验收服务
auto-e2e serve --workspace /path/to/my-web --port 4317 --open

# 检查当前项目的 Codex 验收 Skill
auto-e2e skill status
```

Web UI 维护独立的工作区列表。删除磁盘上的项目后，服务会自动清理对应工作区；也可在侧栏手动移除。选中工作区后，可以新建、切换、编辑和删除 `.auto-e2e/specs/*.spec.json` 用例文件，发起验收并查看历史与 proof。页面右上角支持亮色和暗色主题，选择会保存在浏览器中。

每个 `*.spec.json` 文件只描述一个用例。例如 `.auto-e2e/specs/order-search.spec.json`：

```json
{
  "taskId": "ORDER-01",
  "title": "查询已有订单",
  "requirement": "用户按订单号查询已有订单",
  "acceptanceCriteria": ["结果中显示该订单号"]
}
```

需要“文件输入 → 页面操作 → 结果校验”时，可声明项目内输入文件和结构化页面输出：

```json
{
  "taskId": "PL-FORECAST-01",
  "title": "P&L 预测",
  "requirement": "上传预测模板并执行锁定计算",
  "inputs": [{ "name": "P&L 模板", "path": "fixtures/pl-forecast.xlsx" }],
  "outputs": [{
    "name": "税前利润",
    "location": "预测结果汇总区",
    "expected": 125000.25,
    "match": "numeric",
    "tolerance": 0.01
  }],
  "acceptanceCriteria": ["模板上传成功并完成锁定计算"]
}
```

输入路径必须是项目内相对路径。运行时文件会被临时复制到 BetterWright 允许上传的 artifact 区，结束后删除；项目外路径和逃逸项目的符号链接会被阻止。每个 `outputs` 条目都会追加为必须覆盖的 AC，支持 `equals`、`contains` 和带绝对误差的 `numeric` 比较。

默认运行会扫描目录中的所有匹配文件，忽略其他 JSON。每个文件使用独立 BetterWright session 依次运行，最终保存一条包含用例汇总、逐用例 AC 和 proof 的报告。

随包提供的 `auto-e2e-acceptance` Codex Skill 会指导 Codex 根据需求创建 `.auto-e2e.yaml` 与 `.auto-e2e/specs/*.spec.json`。执行 `auto-e2e skill install` 后，Skill 位于当前项目的 `.codex/skills/auto-e2e-acceptance`；也可使用 `--project-root <path>` 指定项目。这些文件既可由 `auto-e2e run` 执行，也可在 Web UI 中编辑和运行。更新 npm 包后可执行 `auto-e2e skill install --force` 更新项目内已安装的 Skill。

Markdown 需求应包含“验收标准”或 `Acceptance Criteria` 标题及列表；OpenSpec 使用 `Scenario:` 标题。所有标准会转换为稳定的 `AC-01`、`AC-02` 编号。

## 产物

```text
.auto-e2e/
├── specs/
│   ├── order-search.spec.json
│   └── order-empty.spec.json
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
