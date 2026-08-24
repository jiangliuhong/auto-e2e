# auto-e2e 使用说明

`auto-e2e` 是一个自动化端到端（E2E）测试生成与执行 CLI。它读取任务规格（`task-spec.json`），结合 Git Diff 分析需求与代码变更，探索真实页面，生成可运行的 `@playwright/test` 测试，执行后输出统一报告，并通过退出码与 `result.json` 服务任意机器调用方。它不编排调用方工作流，也不修改被测应用业务代码。

整体由三个能力组合而成：

- **Pi**（ChatGPT OAuth）：负责需求分析与测试生成。
- **原生 Playwright / 本机 Chrome**：负责真实页面探索，收集稳定定位器与证据。
- **@playwright/test**：负责正式测试执行与报告。

---

## 目录

- [环境要求](#环境要求)
- [安装](#安装)
- [快速开始（Mock 模式开箱即用）](#快速开始mock-模式开箱即用)
- [命令参考](#命令参考)
  - [全局选项](#全局选项)
  - [init](#init)
  - [auth login / auth browser / auth status](#auth-login--auth-browser--auth-status)
  - [generate](#generate)
  - [verify](#verify)
  - [run](#run)
  - [analyze](#analyze)
  - [report open](#report-open)
  - [config show](#config-show)
- [配置文件](#配置文件)
- [task-spec.json](#task-specjson)
- [输出与报告](#输出与报告)
- [退出码](#退出码)
- [接入真实 AI 与浏览器](#接入真实-ai-与浏览器)
- [自动化调用](#自动化调用)

---

## 环境要求

- Node.js >= 22

---

## 安装

在本仓库本地安装、编译并链接 CLI：

```bash
npm install
npm run link    # 编译并全局链接，之后可直接使用 auto-e2e 命令
```

取消全局链接：

```bash
npm run unlink
```

也可以不链接，直接运行编译产物或源码：

```bash
node dist/cli.js --help        # 编译产物
npm run dev -- --help          # 通过 tsx 直接运行源码
```

验证安装：

```bash
auto-e2e --version
auto-e2e --help
```

---

## 快速开始（Mock 模式开箱即用）

`auto-e2e` 默认 `agent.implementation=mock`、`browser.implementation=mock`，**无需 ChatGPT OAuth 与真实浏览器即可跑通完整的分析与生成闭环**。建议先用 Mock 模式熟悉流程，再接入真实 AI 与浏览器。

```bash
# 1. 在目标项目初始化（生成 .auto-e2e/ 目录与示例配置）
auto-e2e init

# 2. 编辑 .auto-e2e/task-spec.json（init 已生成示例，按实际任务填写）

# 3. 只生成测试（不执行）：分析需求 → 探索页面 → 生成 Playwright 测试
auto-e2e generate --spec .auto-e2e/task-spec.json

# 4. 完整闭环（分析→探索→生成→执行→报告）
auto-e2e verify --spec .auto-e2e/task-spec.json --non-interactive --json

# 5. 读取结构化结果
cat .auto-e2e/reports/latest/result.json

# 6. 打开 HTML 报告
auto-e2e report open
```

---

## 命令参考

### 全局选项

以下选项可附加在任意子命令前：

| 选项 | 说明 |
|---|---|
| `--json` | JSON 模式：stdout 只输出最终 JSON，便于机器解析 |
| `--non-interactive` | 非交互模式：禁止等待用户输入（自动化调用建议使用） |
| `--project-root <path>` | 目标项目根目录，默认为当前工作目录 |
| `-q, --quiet` | 静默日志（等价于 `--log-level warn`） |
| `--log-level <level>` | 日志级别：`debug` / `info` / `warn` / `error` / `silent` |

---

### init

在当前项目初始化 auto-e2e 的配置与目录结构。

```bash
auto-e2e init
auto-e2e init --force        # 覆盖已存在的配置文件
```

生成内容（位于 `.auto-e2e/`）：

- `config.yaml` — 项目配置（见 [配置文件](#配置文件)）
- `task-spec.json` — 任务规格示例（见 [task-spec.json](#task-specjson)）
- `generated/` — 生成的 Playwright 测试目录
- `reports/` — 报告输出目录
- `artifacts/` — 失败截图、Trace、视频等产物目录

---

### auth login / auth browser / auth status

管理 ChatGPT OAuth 与浏览器业务登录。**仅在接入真实 AI / 真实浏览器（`sdk` / `real` 实现）时需要。**

```bash
# 触发 ChatGPT OAuth 登录并保存认证信息
auto-e2e auth login

# 认证开启时，分别准备 BetterWright Profile 与 Playwright storageState
auto-e2e auth browser --profile admin

# 仅重新准备其中一端
auto-e2e auth browser --profile admin --target explorer
auto-e2e auth browser --profile admin --target runner

# 在线检查两端认证状态
auto-e2e auth status --profile admin
```

`--profile <name>` 指定业务身份 Profile，默认读取 `browser.sessionProfile`。`--target` 支持 `all`、`explorer` 和 `runner`，默认 `all`。

BetterWright 和 Playwright 使用两个独立浏览器，首次需要分别完成人工认证。BetterWright 登录态保存在 `$BETTERWRIGHT_HOME` 的命名 Profile 中；Playwright 状态保存在 `.auto-e2e/auth/<profile>/playwright-storage-state.json`。两者都不会写入报告，`.auto-e2e/auth/` 必须保持在 `.gitignore` 中。

认证准备只支持网页 SSO/MFA。依赖企业 Chrome 扩展、客户端证书、mTLS 或设备身份的环境不会被伪装成认证成功。

---

### generate

根据 `task-spec.json` 分析需求、探索页面并生成 Playwright 测试，**不执行**。适合在 verify 前预览将要生成的测试。

```bash
auto-e2e generate --spec .auto-e2e/task-spec.json
```

| 选项 | 说明 |
|---|---|
| `--spec <path>` | task-spec.json 路径，默认 `.auto-e2e/task-spec.json` |

成功后，生成的测试会写入 `playwright.generatedDirectory`（默认 `.auto-e2e/generated`）。

---

### verify

**核心命令。** 完整执行本次任务闭环：分析 → 探索 → 生成 → 执行 → 报告。

```bash
# 基于 task-spec 执行
auto-e2e verify --spec .auto-e2e/task-spec.json --non-interactive --json

# 基于 Git Diff 执行（无 task-spec 时自动推导变更范围）
auto-e2e verify --changed --non-interactive --json
```

| 选项 | 说明 |
|---|---|
| `--spec <path>` | task-spec.json 路径，默认 `.auto-e2e/task-spec.json` |
| `--changed` | 基于 Git Diff 执行（无需 task-spec 时使用） |

`verify` 会：

1. 校验 `task-spec.json`，结合 Git Diff 分析需求与代码变更。
2. 使用 Pi 生成结构化 `test-plan.json`（所有模型输出经 Zod 校验）。
3. 使用 BetterWright 探索真实页面，等待页面稳定，并在真实页面上验证定位器唯一且可见。
   任一目标页面不可达、未获得稳定交互快照或没有已验证定位器时，命令以浏览器错误退出，拒绝继续生成测试。
   SDK 模式会在同一浏览器会话中受约束地处理登录门禁、页面导航和打开只读界面；模型只能点击当前已验证元素，探索器会阻止保存、提交、确认、删除、支付、发布等业务写入动作。成功动作记录在 `exploration.json` 的页面 `actions` 中。
4. 生成后的 TypeScript 会再次进行定位器证据校验：静态 `getBy*` 定位器必须与 `exploration.json` 中 `verified: true` 的定位器一致，CSS `locator()` 会被拒绝；以运行时变量精确查找本次创建测试数据的定位器允许使用。
5. 生成可运行的 `@playwright/test` 测试。
6. 执行测试（失败时保留截图、Trace、视频）。
7. 输出 Console / JSON / HTML / JUnit 报告。
8. 对失败进行分类（`product_defect` / `test_defect` / …）并给出 `confidence`。

执行结束后通过退出码反映结果，结构化结果写入 `result.json`。

---

### run

执行项目已有的 Playwright 测试（全量或指定测试集），不重新生成。

```bash
auto-e2e run --all
auto-e2e run --suite <name>     # 预留：执行指定测试集
auto-e2e run --tag <name>       # 预留：执行指定标签的测试
```

| 选项 | 说明 |
|---|---|
| `--all` | 执行全部测试 |
| `--suite <name>` | （预留）执行指定测试集 |
| `--tag <name>` | （预留）执行指定标签的测试 |

---

### analyze

分析最近一次测试失败原因并分类，写回 `result.json` 的 `failures` 字段。

```bash
auto-e2e analyze --last
```

| 选项 | 说明 |
|---|---|
| `--last` | 分析最近一次 Playwright 结果 |

---

### report open

打开最近一次 HTML 报告（`.auto-e2e/reports/latest/html/index.html`）。

```bash
auto-e2e report open
```

---

### config show

打印当前生效的配置，即默认值 / `config.yaml` / 环境变量的合并结果，便于排查配置问题。

```bash
auto-e2e config show
```

---

## 配置文件

配置文件位于 `.auto-e2e/config.yaml`（`init` 命令生成）。完整示例见 [`examples/config.yaml`](../examples/config.yaml)。

> 安全约束：密码 / Token / Cookie **不允许**写入配置文件；`generation.allowSourceModification` 第一版固定为 `false`（禁止修改业务代码）。

```yaml
project:
  name: demo-web
  baseUrl: http://127.0.0.1:3000
  manageApplication: true         # false：外部托管，跳过本地启动与裸 HTTP 健康检查
  startCommand: npm run dev
  healthUrl: http://127.0.0.1:3000
  startupTimeout: 120000        # 启动超时（ms）

agent:
  implementation: mock           # mock（离线闭环，默认）/ sdk（真实 Pi SDK）
  provider: chatgpt-oauth
  model: default
  thinkingLevel: high            # low / medium / high

browser:
  explorer: betterwright
  browser: chromium
  headless: true
  sessionProfile: admin
  timeout: 30000
  implementation: mock           # mock（离线闭环）/ real（真实 BetterWright 浏览器）

authentication:
  enabled: false                  # true 时 generate/verify/run 会先在线预检
  # 开启时以下字段必填：
  # entryUrl: https://example.com/protected
  # successUrlPrefix: https://example.com/app/
  # successSelector: 'text=业务首页'
  # interactiveTimeout: 600000

playwright:
  configFile: playwright.config.ts
  generatedDirectory: .auto-e2e/generated
  retries: 1
  workers: 1
  trace: retain-on-failure       # off / on / retain-on-failure / on-first-retry
  screenshot: only-on-failure    # off / on / only-on-failure / on-first-retry
  video: retain-on-failure       # off / on / retain-on-failure / on-first-retry

generation:
  requireAcceptanceCriteria: true
  preferTestId: true
  allowSourceModification: false # 固定 false
  maxTestsPerTask: 10
  overwriteGeneratedTests: true

report:
  outputDirectory: .auto-e2e/reports
  artifactDirectory: .auto-e2e/artifacts
  formats: [console, json, html, junit]

knowledge:
  enabled: false
  maxFiles: 3
  maxCharacters: 12000
```

---

## task-spec.json

每次任务的核心输入，描述本次需求、验收标准与代码变更。完整示例见 [`examples/task-spec.json`](../examples/task-spec.json)。

```jsonc
{
  "taskId": "TASK-20260729-001",
  "title": "新增用户禁用功能",
  "requirement": "管理员可以在用户列表禁用用户，禁用后用户不能登录。",
  "acceptanceCriteria": [
    "用户列表展示禁用按钮",
    "点击禁用后需要二次确认",
    "禁用成功后状态显示为已禁用"
  ],
  "changedFiles": [
    "src/pages/users/index.tsx",
    "src/api/users.ts"
  ],
  "changedRoutes": ["/users", "/login"],          // 可选
  "changedApis": ["PUT /api/users/:id/disable"],  // 可选
  "riskHints": ["用户状态缓存可能未刷新"],          // 可选
  "startCommand": "npm run dev",                  // 可选
  "baseUrl": "http://127.0.0.1:3000"              // 可选，须为合法 URL
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `taskId` | ✅ | 任务唯一标识 |
| `title` | ✅ | 任务标题 |
| `requirement` | ✅ | 需求描述 |
| `acceptanceCriteria` | ✅ | 验收标准数组；`verify` 要求非空，为空时返回退出码 4 |
| `changedFiles` | ✅ | 本次变更的文件列表 |
| `changedRoutes` | ⬜ | 变更涉及的路由 |
| `changedApis` | ⬜ | 变更涉及的接口 |
| `riskHints` | ⬜ | 风险提示，辅助分析 |
| `startCommand` | ⬜ | 应用启动命令 |
| `baseUrl` | ⬜ | 应用基础地址（合法 URL） |

---

## 输出与报告

每次执行写入独立运行目录，并同步最近一次兼容入口：

```
.auto-e2e/reports/
├── runs/<runId>/    # 不可变历史运行
└── latest/          # 最近一次完成运行的物理副本
```

`result.json` 遵循如下结构（plan §13.1，Zod 校验）：

```jsonc
{
  "schemaVersion": 2,
  "runId": "20260729T124122123Z-a1b2c3d4",
  "taskId": "TASK-20260729-001",
  "status": "failed",            // passed / failed
  "mode": "incremental",         // incremental / full
  "startedAt": "...",
  "finishedAt": "...",
  "summary": {
    "total": 5, "passed": 4, "failed": 1, "skipped": 0, "durationMs": 12345
  },
  "coverage": {
    "acceptanceCriteria": 3, "covered": 2, "uncovered": ["取消确认时不得修改用户状态"]
  },
  "failures": [
    {
      "test": "禁用用户需要二次确认",
      "category": "product_defect",   // 见下表
      "message": "点击禁用后未弹出确认框",
      "expected": "...", "actual": "...",
      "confidence": 0.92,
      "artifacts": { "screenshot": "...", "trace": "...", "video": "..." }
    }
  ]
}
```

失败分类（`failure.category`）：

| category | 含义 |
|---|---|
| `product_defect` | 业务缺陷 |
| `test_defect` | 测试脚本问题 |
| `environment_failure` | 环境或启动失败 |
| `data_failure` | 测试数据问题 |
| `auth_failure` | 登录或权限问题 |
| `browser_failure` | 浏览器执行问题 |
| `flaky` | 疑似不稳定测试 |
| `unknown` | 无法判断 |

失败时的截图 / Trace / 视频保留在 `artifacts/`，路径同时记录在对应 `failures[].artifacts` 中。

---

## 退出码

| Code | 含义 |
|---|---|
| 0 | 测试全部通过 |
| 1 | 测试执行完成，但存在失败 |
| 2 | 应用环境启动失败 |
| 3 | 测试生成失败 |
| 4 | 需求或验收标准信息不足 |
| 5 | 登录或认证失败 |
| 6 | 浏览器执行或探索失败 |
| 7 | 配置错误 |
| 8 | Playwright 执行异常 |
| 9 | 未知错误 |

---

## 接入真实 AI 与浏览器

默认 Mock 模式无需任何外部依赖。接入真实能力时：

1. 安装可选依赖（Pi SDK）。真实浏览器直接使用本机 Google Chrome（默认通过 `channel: chrome`），无需安装额外依赖包。
2. 编辑 `.auto-e2e/config.yaml`：
   - `agent.implementation` 改为 `sdk`
   - `browser.implementation` 改为 `real`
3. 执行 `auto-e2e auth login` 完成 ChatGPT OAuth 认证。
4. （配置启用业务认证时）执行 `auto-e2e auth browser --profile <name>`，分别准备探索和执行认证。

完成后即可使用 `verify` 触发真实的分析、探索、生成与执行。

---

## 自动化调用

开发者、脚本或其他自动化系统都可以执行
`auto-e2e verify --spec .auto-e2e/task-spec.json --non-interactive --json`，
并读取退出码与 `.auto-e2e/reports/latest/result.json`。auto-e2e 不决定调用方是否修改代码或再次执行测试。
