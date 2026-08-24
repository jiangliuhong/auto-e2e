# auto-e2e

基于 **Pi**（ChatGPT OAuth，负责需求分析与测试生成）+ **原生 Playwright / 本机 Chrome**（页面探索与正式执行）+ **@playwright/test**（报告与归因）的自动化 E2E 测试生成与执行 CLI。

开发者或自动化调用方提供 `task-spec.json`，`auto-e2e` 据此完成测试分析、页面探索、Playwright 测试生成、执行与报告。它只处理 E2E 测试，不编排调用方工作流，也不修改被测应用业务代码。

## 功能

- 读取并校验 `task-spec.json`，结合 Git Diff 分析需求与代码变更。
- 使用 Pi 生成结构化 `test-plan.json`（所有模型输出经 Zod 校验）。
- 使用 Playwright 探索真实页面，只将已确认唯一且可见的稳定定位器交给测试生成器；探索证据不足时拒绝猜测生成。
- SDK 模式支持同会话状态化探索，可处理页面内无凭据登录和打开只读业务界面；探索阶段硬性阻止保存、提交、确认和删除等写操作。
- 生成阶段校验静态 Playwright 定位器必须来自真实探索证据，并拒绝未取证的 CSS `locator()`。
- 生成可运行的 `@playwright/test` TypeScript 测试。
- 执行增量测试或全量已有测试。
- 输出 Console / JSON / HTML / JUnit 报告，失败时保留截图、Trace、视频。
- 对失败进行分类（product_defect / test_defect / …）并输出 confidence。
- 非交互模式、固定重试、明确退出码，便于机器调用。

## 环境要求

- Node.js >= 22

## 安装

```bash
# 在本仓库本地安装并链接 CLI（编译 + 全局链接，一步到位）
npm install
npm run link   # 之后可直接使用 auto-e2e

# 取消全局链接
npm run unlink

# 或直接运行
node dist/cli.js --help
```

## 命令

| 命令 | 说明 |
|---|---|
| `init` | 初始化 auto-e2e 配置与目录结构 |
| `auth login` | 触发 ChatGPT OAuth 登录 |
| `auth browser --profile <name> [--target all\|explorer\|runner]` | 分别准备 Explorer 与 Runner 业务认证 |
| `auth status --profile <name>` | 在线检查业务认证状态 |
| `generate --spec <path>` | 分析需求、探索页面并生成 Playwright 测试（不执行） |
| `verify --spec <path>` | 完整执行本次任务闭环：分析→探索→生成→执行→报告 |
| `verify --changed` | 基于 Git Diff 执行 |
| `run --all` | 执行项目全部已有 Playwright 测试 |
| `analyze --last` | 分析最近一次失败原因并分类 |
| `report open` | 打开最近一次 HTML 报告 |

全局选项：`--json`（stdout 只输出最终 JSON）、`--non-interactive`、`--project-root <path>`、`-q/--quiet`、`--log-level <level>`。

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

## 开发

```bash
npm run build        # 编译到 dist/
npm run typecheck    # tsc --noEmit
npm test             # 运行 vitest 单元测试
npm run dev -- --help  # 通过 tsx 直接运行
./scripts/validate-local.sh # 完整本地 Mock 验证
```

已准备真实 OAuth，以及配置要求的业务认证时，可运行 `./scripts/validate-local.sh --real` 执行真实 Benchmark。

## Examples

- [`examples/demo-app`](examples/demo-app)：无外部依赖的本地 Benchmark Demo。
- [`examples/asset-management-metric-results-demo`](examples/asset-management-metric-results-demo)：针对 `127.0.0.1:3000` 本地资管系统模型结果新增和删除的受保护真实 E2E Example；测试会在登录页选择用户完成登录。

## 端到端流程（mock 模式开箱即用）

`auto-e2e` 默认 `agent.implementation=mock`、`browser.implementation=mock`，无需 ChatGPT OAuth 与真实浏览器即可跑通完整分析与生成闭环：

```bash
# 1. 在目标项目初始化
auto-e2e init

# 2. 编辑 .auto-e2e/task-spec.json（init 已生成示例）

# 3. 分析需求 → 探索页面 → 生成 Playwright 测试（不执行）
auto-e2e generate --spec .auto-e2e/task-spec.json

# 4. 完整闭环（分析→探索→生成→执行→报告）
auto-e2e verify --spec .auto-e2e/task-spec.json --non-interactive --json

# 5. 读取结果
cat .auto-e2e/reports/latest/result.json

# 6. 打开 HTML 报告
auto-e2e report open
```

接入真实 AI 与浏览器时，把 `.auto-e2e/config.yaml` 中 `agent.implementation` 与 `browser.implementation` 改为 `sdk` / `real`，并先执行 `auto-e2e auth login`。

## 自动化调用

任何调用方都可以使用非交互 CLI、退出码和 `result.json`。是否修改代码或再次执行测试完全由调用方决定，不属于 auto-e2e 的职责。

## 当前进度

v0.2 提供运行历史、Prompt 覆盖、Evaluation、Knowledge Base、最小 Demo Benchmark 和本地验证入口。真实 AI/浏览器使用前仍需安装可选依赖并完成认证与业务 Session 准备。
