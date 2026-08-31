# auto-e2e 使用说明

auto-e2e 的唯一工作流是：读取原生 Spec Bundle → 按业务步骤调用 BetterWright → 复算结果 → 保存 proof 与历史 → 通过 CLI 或 `serve` 查询。完整契约见 [Spec Bundle v2](spec-bundle-v2.md)。

## 用例来源

正式运行只读取 auto-e2e 原生 spec，不依赖 Markdown 或 OpenSpec。`--spec <path>` 可指定 bundle 目录、`spec.json` 或包含多个 bundle 的目录；默认递归扫描 `.auto-e2e/specs/**/spec.json`。

每个用例独立保存在 `.auto-e2e/specs/<name>/spec.json`，最小格式为：

```json
{
  "schemaVersion": 2,
  "taskId": "TASK-001",
  "title": "用户查询",
  "requirement": "用户可以按名称查询",
  "steps": [{ "id": "STEP-01", "instruction": "按名称查询", "expected": "查询完成" }],
  "results": [{ "id": "RESULT-01", "name": "查询结果", "actual": "结果区域", "expected": "匹配结果", "match": "contains" }]
}
```

运行器按 bundle 相对路径排序，每个用例使用独立 BetterWright session。Bundle 文件路径相对于 `spec.json`，禁止绝对路径、`..` 和符号链接逃逸。旧平铺 `*.spec.json` 暂时只作为迁移兼容。

## 命令

### doctor

`auto-e2e doctor` 默认按两组检查验收运行条件：

- `tool`：Node.js、SQLite、BetterWright、浏览器 backend 和模型后端。
- `project`：项目配置、存储路径、验收规格、输入文件和目标 URL 连通性。

```bash
auto-e2e doctor
auto-e2e doctor --tool
auto-e2e doctor --project
auto-e2e doctor --json
```

`--tool` 与 `--project` 互斥。每项结果为 `pass`、`warn`、`fail` 或 `skip`；任一 `fail` 返回退出码 2，只有 warning 仍返回 0。未找到默认验收规格只会警告。doctor 不启动真实浏览器任务、不调用模型、不写入验收历史。

### run

```bash
auto-e2e run [--spec <path>]
  [--url <url>] [--profile <name>] [--model <model>]
  [--session <name>] [--headed] [--fresh] [--json]
```

BetterWright 的每个 Bundle 最终答案必须按声明顺序完整覆盖全部 steps 和 results。遗漏、乱序、未知 ID、非法状态转换或非法 JSON 均视为该用例阻塞。

### list / show

```bash
auto-e2e list --limit 50
auto-e2e show <run-id> --json
```

两者直接查询 `.auto-e2e/history.sqlite`。

### serve

```bash
auto-e2e serve --workspace /path/to/project --host 127.0.0.1 --port 4317
```

服务默认只监听本机，提供：

- `GET /api/status`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `DELETE /api/workspaces/:workspaceId`
- `GET /api/workspaces/:workspaceId/task-specs`
- `GET /api/workspaces/:workspaceId/task-specs/:fileName`
- `PUT /api/workspaces/:workspaceId/task-specs/:fileName`
- `DELETE /api/workspaces/:workspaceId/task-specs/:fileName`
- `GET /api/workspaces/:workspaceId/task-specs/:fileName/resources`
- `PUT /api/workspaces/:workspaceId/task-specs/:fileName/resources/:relativePath`
- `DELETE /api/workspaces/:workspaceId/task-specs/:fileName/resources/:relativePath`
- `GET /api/workspaces/:workspaceId/runs`
- `GET /api/workspaces/:workspaceId/runs/:runId`
- `POST /api/workspaces/:workspaceId/runs`
- `GET /api/workspaces/:workspaceId/artifacts/:relativePath`

资源上传接口接收二进制请求体，单文件上限为 100 MiB；`relativePath` 必须至少包含一个目录层级，且不能通过 `..`、反斜杠或符号链接逃逸 Bundle。旧版 `*.spec.json` 不支持资源接口。

工作区注册表位于 `~/.auto-e2e/workspaces.json`（可通过 `AUTO_E2E_HOME` 更改根目录）。每次读取列表时会自动移除磁盘上已经不存在的工作区。Web UI 支持工作区切换、多个用例的新建/选择/编辑/删除、Bundle 资源上传与删除、验收执行、历史查看及亮/暗主题切换。

### skill

```bash
# 安装到当前项目 .codex/skills/auto-e2e-acceptance
auto-e2e skill install
auto-e2e skill status
auto-e2e skill install --force

# 安装到指定项目
auto-e2e --project-root /path/to/project skill install
```

Skill 只安装到目标项目的 `.codex/skills/auto-e2e-acceptance`。安装后的 Skill 能根据需求生成 `.auto-e2e.yaml` 和自包含 Spec Bundle，并通过 CLI 或 Web UI 执行相同验收链路。

Web 页面展示运行历史、需求正文、Commit、套件用例汇总、逐用例验收矩阵与 proof。

## 机器调用

`--json` 模式下 stdout 只包含最终 JSON；BetterWright 进度和日志写入 stderr。调用方应依据退出码和返回的 `run.status` 判断结果，未全部 passed 或明确 blocked 时不得宣称需求完成。
