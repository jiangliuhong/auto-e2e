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

### init

```bash
auto-e2e init
auto-e2e init --login grok
auto-e2e init --skip-auth
```

`init` 直接调用 auto-e2e 包内固定版本的 BetterWright，下载并验证托管浏览器，
且不会安装 BetterWright 的全局 Agent Skill 或 MCP 配置。未检测到模型后端时默认发起
Codex OAuth 登录；已有 API Key、Codex/Grok 登录或本地模型时不会重复登录。
`--non-interactive` 模式不会隐式发起 OAuth，除非显式传入 `--login codex` 或
`--login grok`。

### workspace init

```bash
auto-e2e --project-root /path/to/project workspace init
```

创建 `.auto-e2e/config.yaml` 和 `.auto-e2e/specs/`。配置包含项目目录名、默认目标地址、模型、Profile、浏览器模式、并发数和高风险操作限制；运行数据路径保持省略，以便配置跨环境使用。重复执行会保留已有的新配置。检测到旧版 `.auto-e2e.yaml` 且新配置尚不存在时，命令会停止并提示先迁移，避免新文件改变现有配置优先级。

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
auto-e2e show <run-id> --format html --output report.html
auto-e2e show <run-id> --format markdown --output report.md
```

`show` 指定 `--format` 时导出包含截图 proof 的独立文件；省略 `--output` 时写入当前目录的 `auto-e2e-<run-id>.html` 或 `.md`。`--format md` 可作为 `markdown` 的简写。

两者使用同一套配置解析后的历史数据库，默认位于 `~/.auto-e2e/projects/<workspaceId>/history.sqlite`。已有项目内数据和显式路径保持兼容，详见 [配置与存储迁移](storage-layout.md)。

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
- `POST /api/workspaces/:workspaceId/manual-login`
- `GET /api/workspaces/:workspaceId/runs/:runId`
- `GET /api/workspaces/:workspaceId/runs/:runId/export?format=html|markdown`
- `POST /api/workspaces/:workspaceId/runs`
- `GET /api/workspaces/:workspaceId/artifacts/:relativePath`

资源上传接口接收二进制请求体，单文件上限为 100 MiB；`relativePath` 必须至少包含一个目录层级，且不能通过 `..`、反斜杠或符号链接逃逸 Bundle。旧版 `*.spec.json` 不支持资源接口。

工作区注册表位于 `~/.auto-e2e/workspaces.json`（可通过 `AUTO_E2E_HOME` 更改注册表和默认运行数据的根目录）。每次读取列表时会自动移除磁盘上已经不存在的工作区。Web UI 支持工作区切换、多个用例的新建/选择/编辑/删除、Bundle 资源上传与删除、按需勾选一个或多个用例执行验收、历史查看及亮/暗主题切换。执行页默认全选全部有效用例，格式错误的用例会显示但不能选中。

### skill

```bash
# 安装到当前项目 .codex/skills/
auto-e2e skill install
auto-e2e skill status
auto-e2e skill install --force

# 安装到指定项目
auto-e2e --project-root /path/to/project skill install
```

Skill 只安装到目标项目的 `.codex/skills/`，包括 `auto-e2e-acceptance` 和 `auto-e2e-spec-coverage`。安装后的 Skill 能根据需求生成 `.auto-e2e/config.yaml` 和自包含 Spec Bundle，通过 CLI 或 Web UI 执行验收，并静态核对业务功能与 Spec 的覆盖关系。

Web 页面展示运行历史、需求正文、Commit、套件用例汇总、逐用例验收矩阵与 proof。

### 人工登录

“执行验收”页面的“打开手动登录”按钮使用当前目标 URL、Profile 和浏览器模式启动 BetterWright Live View，并直接嵌入当前页面。用户在该真实浏览器会话中完成登录、扫码、MFA 或 Passkey 后，Cookie 等登录状态保存在 `$BETTERWRIGHT_HOME/browser/profiles/<profile>`，后续运行无需再次传递凭据。验收执行期间，页面会通过事件流切换到当前用例实际使用的浏览器 Session。Live View URL 包含临时控制令牌，只通过本次 API 响应或内存事件交给页面，不保存到工作区配置、SQLite 历史或报告。

如果已有 Profile 曾被更高版本的 Chromium 打开，auto-e2e 会保留原目录，仅在其 BetterWright 子进程中移除不匹配的外部 Chromium 路径，并自动改用托管浏览器对应的兼容 Profile（例如 `auto-e2e-bw151-managed`）。兼容 Profile 首次使用时需要重新登录，但不会删除或降级原 Profile，也不会修改用户的全局环境变量。

## 机器调用

`--json` 模式下 stdout 只包含最终 JSON；BetterWright 进度和日志写入 stderr。调用方应依据退出码和返回的 `run.status` 判断结果，未全部 passed 或明确 blocked 时不得宣称需求完成。

全局 `--config <path>` 可选择项目配置，优先于 `.auto-e2e/config.yaml` 和旧 `.auto-e2e.yaml`。相对路径以 `--project-root` 为基准；`serve` 中的显式配置仅用于启动时指定的工作区，其他工作区各自加载配置。
