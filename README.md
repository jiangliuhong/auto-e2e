# auto-e2e

用自然语言描述业务需求，让 AI 在真实浏览器中完成验收，并留下可追溯的结果与截图证据。

auto-e2e 是一个基于 BetterWright 的本地需求验收工具。它适合在功能开发完成后，快速确认关键业务流程是否符合预期：你只需提供目标地址、操作步骤和预期结果，auto-e2e 会逐个执行用例、核对结果，并保存 proof、结构化报告和运行历史。

它不生成 Playwright 脚本，不修改被测应用，也不要求你把账号密码写进测试配置。

## 为什么使用 auto-e2e

- **面向需求，而不是选择器**：用“查询订单并确认状态”这样的业务语言描述验收，无需维护 CSS Selector 或 XPath。
- **运行在真实浏览器中**：支持页面操作、文件上传、登录态复用，以及需要扫码、MFA、Passkey 的人工登录流程。
- **每个结论都有依据**：验收结果包含逐步骤状态、实际值、截图和相关产物，方便复核与追踪。
- **适合本地和自动化环境**：既可以通过 Web UI 使用，也可以通过 CLI、JSON 输出和退出码接入 CI。
- **数据留在本机**：配置、SQLite 历史、报告和截图默认保存在当前项目中。

## 适用场景

- 发布前验证注册、登录、搜索、下单等关键用户路径
- 根据产品需求或验收标准执行一次性回归
- 验证表格上传、页面计算和文件下载结果
- 为人工验收补充可复现的步骤和截图证据
- 在 CI 中对测试环境运行小规模业务验收

如果你需要长期维护、毫秒级执行的大规模确定性测试套件，Playwright 等代码化测试框架通常更合适。auto-e2e 更关注“需求是否真的可用”以及“结论是否有证据”。

## 快速开始

### 1. 安装

需要 Node.js 22.18.0 或更高版本。通过 npmjs 全局安装：

```bash
npm install --global @jarome/auto-e2e
```

首次安装后，初始化随包提供的 BetterWright 浏览器和模型后端：

```bash
auto-e2e init
```

如果本机已有可用的 API Key、Codex/Grok 登录或本地模型，初始化会直接复用；否则会引导完成 Codex 登录。该操作通常每台机器只需执行一次。

### 2. 配置被测项目

进入你的 Web 项目，在根目录创建 `.auto-e2e.yaml`：

```yaml
project:
  name: my-web
  baseUrl: http://localhost:3000

acceptance:
  model: gpt-5.6-sol
  profile: my-web-test
  headed: false

report:
  outputDirectory: .auto-e2e/reports
  artifactDirectory: .auto-e2e/artifacts
```

运行验收前，请确保 `baseUrl` 对应的应用已经启动且可以访问。

### 3. 添加第一个验收用例

创建 `.auto-e2e/specs/search-order/spec.json`：

```json
{
  "schemaVersion": 2,
  "taskId": "ORDER-SEARCH-01",
  "title": "按订单号查询订单",
  "requirement": "用户可以按订单号查询已有订单，并看到正确的订单状态。",
  "steps": [
    {
      "id": "STEP-01",
      "instruction": "进入订单查询页面，使用订单号 ORDER-001 发起查询",
      "expected": "查询完成并显示一条订单记录"
    }
  ],
  "results": [
    {
      "id": "RESULT-01",
      "name": "订单状态",
      "actual": "查询结果中 ORDER-001 的状态",
      "expected": "已支付",
      "match": "equals"
    }
  ]
}
```

一个目录代表一个独立场景。`steps` 描述如何完成业务流程，`results` 描述最终要核对的结果；它们都应使用用户能理解的业务语言。

### 4. 检查并运行

```bash
auto-e2e doctor
auto-e2e run
```

运行结束后，终端会显示整体状态、通过的用例数、通过的验收项数和 Run ID。返回 `passed` 表示所有用例及验收项均已通过。

### 5. 查看报告

```bash
auto-e2e serve --open
```

Web UI 默认运行在 `http://127.0.0.1:4317`。你可以在其中管理工作区和用例、发起验收、处理人工登录，并查看历史记录、逐步骤结果与 proof。

## 使用 Codex 编写验收用例

auto-e2e 随包提供了项目级 Codex Skill，可以根据一段需求生成配置和 Spec Bundle：

```bash
cd /path/to/my-web
auto-e2e skill install
```

安装后，可以直接向 Codex 描述目标，例如：

> 为“用户按订单号查询订单并核对支付状态”创建 auto-e2e 验收用例。

Skill 只会安装到当前项目的 `.codex/skills/auto-e2e-acceptance`，不会修改用户级 Skill 或 MCP 配置。

## 常用命令

| 命令 | 用途 |
|---|---|
| `auto-e2e init` | 初始化浏览器和模型后端 |
| `auto-e2e doctor` | 检查工具链、项目配置、用例和目标地址 |
| `auto-e2e run` | 运行 `.auto-e2e/specs` 下的全部用例 |
| `auto-e2e run --spec <path>` | 运行指定用例或用例目录 |
| `auto-e2e run --headed` | 显示验收浏览器窗口 |
| `auto-e2e run --concurrency 4` | 并发运行多个用例 |
| `auto-e2e list` | 列出最近的验收记录 |
| `auto-e2e show <run-id>` | 查看一次验收详情 |
| `auto-e2e serve --open` | 启动本地 Web UI |
| `auto-e2e skill status` | 检查当前项目的 Codex Skill |

所有命令均支持全局 `--json` 选项。JSON 模式下，stdout 只输出最终结果，进度和日志写入 stderr，便于脚本和 CI 稳定解析。

## 登录与敏感信息

不要把密码、Token、Cookie、OAuth 信息写入 `.auto-e2e.yaml` 或 Spec Bundle。

登录状态由 BetterWright Profile 管理。遇到扫码、MFA 或 Passkey 时，启动 Web UI，在“执行验收”页面选择目标 URL 和 Profile，然后点击“打开手动登录”。登录完成后，后续验收会复用同一 Profile。

建议为验收准备权限受限的独立账号，并在配置中保留默认的高风险操作限制：

```yaml
acceptance:
  forbiddenActions:
    - 删除数据
    - 发布或部署
    - 发起付款或购买
    - 向外部人员发送消息
```

## 文件输入与预期结果

需要上传文件或比较下载结果时，把相关资源放进用例目录：

```text
.auto-e2e/specs/pl-forecast/
├── spec.json
├── inputs/
│   └── forecast.xlsx
└── expected/
    └── result.xlsx
```

Spec 可以通过 `files` 引用这些文件。所有路径均相对于当前用例目录，不能访问目录外的内容。完整格式、表格比较和误差配置请参阅 [Spec Bundle v2](docs/spec-bundle-v2.md)。

## 验收产物

默认情况下，项目内会生成：

```text
.auto-e2e/
├── specs/                 # 验收用例及其输入文件
├── history.sqlite         # 结构化运行历史
├── artifacts/<runId>/     # 截图、下载文件等 proof
└── reports/acceptance/    # JSON 验收报告
```

建议把 `history.sqlite`、`artifacts` 和 `reports` 加入 `.gitignore`；是否提交 `specs` 取决于团队是否希望对验收要求进行版本管理。

## CI 集成

auto-e2e 使用固定退出码，方便流水线判断结果：

| 退出码 | 含义 |
|---:|---|
| `0` | 全部通过 |
| `1` | 存在验收失败 |
| `2` | 环境、配置、登录或浏览器阻塞 |
| `3` | auto-e2e 自身异常 |

在 CI 中建议使用 `auto-e2e --non-interactive run --json`，并同时检查退出码与返回结果。GitLab Runner 的完整接入示例见 [GitLab Runner 集成](docs/gitlab-runner-integration.md)。

## 更多文档

- [完整使用说明](docs/usage.md)
- [Spec Bundle v2 格式](docs/spec-bundle-v2.md)
- [步骤与结果校验](docs/parameter-step-result-validation.md)
- [版本变更记录](CHANGELOG.md)

## 参与项目

欢迎通过 [Issue](https://github.com/jiangliuhong/auto-e2e/issues) 报告问题、提出使用场景或讨论改进建议，也欢迎提交 Pull Request。

推送到 `main` 或提交以 `main` 为目标的 PR 时，GitHub Actions 会自动运行检查。完成 npm Trusted Publisher 一次性授权后，将新版本合并到 `main` 并推送匹配的 `v*.*.*` tag，即可自动发布到 npmjs；单独合并不会发布。配置与操作步骤见 [npm 自动发布说明](docs/npm-release.md)。

提交代码前，请运行：

```bash
npm run typecheck
npm test
npm run build
```

维护者发布新版本前，可先完整执行构建、测试和 npm 包内容检查：

```bash
npm run publish:npm -- --dry-run
```

确认版本号、Git 工作区和 npm 登录状态后发布到 npmjs.com：

```bash
npm login --registry https://registry.npmjs.org
npm run publish:npm
```

脚本默认发布到 `latest`；预发布版本可追加 `--tag next`。正式发布要求 Git
工作区干净，确需从未提交状态发布时可显式追加 `--allow-dirty`。
