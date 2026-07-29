# auto-e2e

基于 **Pi**（ChatGPT OAuth，负责需求分析与测试生成）+ **BetterWright**（真实页面探索）+ **@playwright/test**（正式执行与报告）的自动化 E2E 测试生成与执行 CLI。

Codex 完成开发后整理出 `task-spec.json`，`auto-e2e` 据此分析需求与代码变更、探索真实页面、生成增量 Playwright 测试、执行并输出统一报告，最终通过退出码和 `result.json` 把结果交回 Codex。

## 功能

- 读取并校验 `task-spec.json`，结合 Git Diff 分析需求与代码变更。
- 使用 Pi 生成结构化 `test-plan.json`（所有模型输出经 Zod 校验）。
- 使用 BetterWright 探索真实页面，收集稳定定位器与证据。
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
| `auth browser --profile <name>` | 使用 BetterWright 打开浏览器完成业务系统登录 |
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
| 6 | BetterWright 或浏览器执行失败 |
| 7 | 配置错误 |
| 8 | Playwright 执行异常 |
| 9 | 未知错误 |

## 开发

```bash
npm run build        # 编译到 dist/
npm run typecheck    # tsc --noEmit
npm test             # 运行 vitest 单元测试
npm run dev -- --help  # 通过 tsx 直接运行
```

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

## Codex 集成

参见 [`examples/AGENTS.md`](./examples/AGENTS.md)，将其内容加入目标项目的 `AGENTS.md` 或 Codex Skill，Codex 即可在完成开发后生成 task-spec、调用 `auto-e2e verify`、读取 `result.json` 并按 `failure.category` 决策。

## 当前进度

> **已完成全部十阶段。** CLI 骨架、配置与输入模型、Git/项目检测、Pi 接入（Mock + SDK）、BetterWright 接入（Mock + 真实）、测试生成、执行与报告、失败分析、全量执行、Codex 集成示例均已实现。mock 模式下 `init → generate` 端到端可跑通。真实 AI/浏览器调用通过抽象接口接入，使用前需安装可选依赖（Pi SDK / betterwright）并完成 `auth login`。完整开发计划见 [`plan.md`](./plan.md)。
