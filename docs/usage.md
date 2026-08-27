# auto-e2e 使用说明

auto-e2e 的唯一工作流是：读取需求 → 固化编号验收标准 → 调用 BetterWright → 校验结构化结果 → 保存 proof 与历史 → 通过 CLI 或 `serve` 查询。

## 需求来源

一次 `run` 只能选择一个来源：

- `--spec <path>`：读取 `task-spec.json`；默认 `.auto-e2e/task-spec.json`。
- `--requirement <path>`：读取 Markdown 中的验收标准列表。
- `--change <name>`：读取 `openspec/changes/<name>` 中的 Markdown artifacts。

task-spec 最小格式：

```json
{
  "taskId": "TASK-001",
  "title": "用户查询",
  "requirement": "用户可以按名称查询",
  "acceptanceCriteria": ["显示匹配结果", "空结果显示明确提示"]
}
```

## 命令

### doctor

执行 `betterwright doctor --json`。环境不完整时返回退出码 2。

### run

```bash
auto-e2e run [--spec <path> | --requirement <path> | --change <name>]
  [--url <url>] [--profile <name>] [--model <model>]
  [--session <name>] [--headed] [--fresh] [--json]
```

BetterWright 的最终答案必须覆盖全部 AC，并符合结构化结果 Schema。遗漏、重复、未知 AC 或非法 JSON 均视为浏览器验收阻塞。

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
- `GET /api/workspaces/:workspaceId/task-spec`
- `PUT /api/workspaces/:workspaceId/task-spec`
- `GET /api/workspaces/:workspaceId/runs`
- `GET /api/workspaces/:workspaceId/runs/:runId`
- `POST /api/workspaces/:workspaceId/runs`
- `GET /api/workspaces/:workspaceId/artifacts/:relativePath`

工作区注册表位于 `~/.auto-e2e/workspaces.json`（可通过 `AUTO_E2E_HOME` 更改根目录）。每次读取列表时会自动移除磁盘上已经不存在的工作区。Web UI 支持工作区切换、任务规格编辑、验收执行、历史查看及亮/暗主题切换。

### skill

```bash
# 安装到当前项目 .codex/skills/auto-e2e-acceptance
auto-e2e skill install
auto-e2e skill status
auto-e2e skill install --force

# 安装到指定项目
auto-e2e --project-root /path/to/project skill install
```

Skill 只安装到目标项目的 `.codex/skills/auto-e2e-acceptance`，不写入用户全局 `~/.codex/skills`。安装后的 Skill 能根据需求生成当前严格契约的 `.auto-e2e.yaml` 和 `.auto-e2e/task-spec.json`，并通过 CLI 或 Web UI 执行相同的验收链路。

Web 页面展示运行历史、需求正文、Commit、验收矩阵与 proof。

## 机器调用

`--json` 模式下 stdout 只包含最终 JSON；BetterWright 进度和日志写入 stderr。调用方应依据退出码和返回的 `run.status` 判断结果，未全部 passed 或明确 blocked 时不得宣称需求完成。
