# auto-e2e 使用说明

auto-e2e 的唯一工作流是：读取需求 → 固化编号验收标准 → 调用 BetterWright → 校验结构化结果 → 保存 proof 与历史 → 通过 CLI 或 `serve` 查询。

## 需求来源

一次 `run` 只能选择一个来源：

- `--spec <path>`：读取一个 `*.spec.json` 文件或扫描指定目录；默认扫描 `.auto-e2e/specs`。
- `--requirement <path>`：读取 Markdown 中的验收标准列表。
- `--change <name>`：读取 `openspec/changes/<name>` 中的 Markdown artifacts。

每个用例独立保存在 `.auto-e2e/specs/<name>.spec.json`，最小格式为：

```json
{
  "taskId": "TASK-001",
  "title": "用户查询",
  "requirement": "用户可以按名称查询",
  "acceptanceCriteria": ["显示匹配结果", "空结果显示明确提示"]
}
```

一个目录中可以有任意多个匹配文件。运行器按文件名排序，只读取 `*.spec.json`，忽略其他文件。`taskId` 可省略，此时使用文件名去掉 `.spec.json` 后的部分作为用例 ID；多个文件的最终 ID 必须唯一。每个用例独立调用 BetterWright，汇总状态存在 failed 时为 failed，存在 blocked 时为 blocked，只有全部用例通过才是 passed。旧版 `.auto-e2e/task-spec.json` 不再读取。

数据驱动用例可增加 `inputs` 和 `outputs`。`inputs[].path` 是项目内相对文件路径，适合 Excel/CSV 等上传模板；运行器会将文件临时暂存到 BetterWright artifact 区供浏览器上传，并阻止目录穿越及项目外符号链接。`outputs` 描述页面输出的名称、可见位置、期望值与比较方式（`equals`、`contains`、`numeric`）；数字可使用 `tolerance` 指定绝对误差。每个输出会自动成为额外的强制 AC。

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
auto-e2e run [--spec <path> | --requirement <path> | --change <name>]
  [--url <url>] [--profile <name>] [--model <model>]
  [--session <name>] [--headed] [--fresh] [--json]
```

BetterWright 的每个用例最终答案必须覆盖该用例全部 AC，并符合结构化结果 Schema。遗漏、重复、未知 AC 或非法 JSON 均视为该用例阻塞。

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
- `GET /api/workspaces/:workspaceId/runs`
- `GET /api/workspaces/:workspaceId/runs/:runId`
- `POST /api/workspaces/:workspaceId/runs`
- `GET /api/workspaces/:workspaceId/artifacts/:relativePath`

工作区注册表位于 `~/.auto-e2e/workspaces.json`（可通过 `AUTO_E2E_HOME` 更改根目录）。每次读取列表时会自动移除磁盘上已经不存在的工作区。Web UI 支持工作区切换、多个用例文件的新建/选择/编辑/删除、验收执行、历史查看及亮/暗主题切换。

### skill

```bash
# 安装到当前项目 .codex/skills/auto-e2e-acceptance
auto-e2e skill install
auto-e2e skill status
auto-e2e skill install --force

# 安装到指定项目
auto-e2e --project-root /path/to/project skill install
```

Skill 只安装到目标项目的 `.codex/skills/auto-e2e-acceptance`，不写入用户全局 `~/.codex/skills`。安装后的 Skill 能根据需求生成当前严格契约的 `.auto-e2e.yaml` 和 `.auto-e2e/specs/*.spec.json`，并通过 CLI 或 Web UI 执行相同的验收链路。

Web 页面展示运行历史、需求正文、Commit、套件用例汇总、逐用例验收矩阵与 proof。

## 机器调用

`--json` 模式下 stdout 只包含最终 JSON；BetterWright 进度和日志写入 stderr。调用方应依据退出码和返回的 `run.status` 判断结果，未全部 passed 或明确 blocked 时不得宣称需求完成。
