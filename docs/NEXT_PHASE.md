# auto-e2e v0.2 Development Plan

## 1. 文档定位

本文定义 auto-e2e v0.2 的开发范围、阶段和验收标准。

本文是规划文档，不代表其中能力已经实现。当前行为以源码、Zod Schema、测试、README 和 `docs/usage.md` 为准。

v0.2 的目标不是扩展业务功能，而是把现有 E2E 测试链路打磨成稳定、可验证、可持续演进的工具。

## 2. 产品边界

auto-e2e 只负责 E2E 测试：

1. 读取并校验测试任务。
2. 分析需求与代码变更。
3. 生成结构化测试计划。
4. 探索被测页面并收集证据。
5. 生成 `@playwright/test` 测试。
6. 执行测试。
7. 分析失败并输出机器可读报告。

auto-e2e 可以由开发者、Codex、CI 或其他自动化系统调用，但不感知、不控制调用方的工作过程。

auto-e2e 不负责：

- 编排 Codex 或其他 Agent 的开发流程。
- 决定调用方是否修复代码。
- 限制或管理调用方的修复轮数。
- 自动修改被测应用的业务代码。
- 管理 Agent 的任务、上下文、状态或生命周期。

调用方可以自行读取退出码和 `result.json`，决定是否修改代码以及是否再次执行 auto-e2e。这属于调用方行为，不属于 auto-e2e 的产品能力或完成标准。

## 3. 当前基线

当前仓库已经具备以下模块：

- CLI 框架与固定退出码。
- `task-spec.json` 校验。
- Git Diff 读取与变更分析。
- Mock 与 SDK 两种 Agent 适配器。
- Mock 与真实 BetterWright 适配器。
- 结构化测试计划。
- Playwright 测试生成与执行。
- 增量 `verify` 和全量 `run`。
- JSON、Markdown、Playwright HTML/JUnit 报告接入。
- 失败分类和机器可读 `result.json`。

当前默认使用 Mock Agent 和 Mock Browser，适合离线验证主链路。真实 Pi SDK、ChatGPT OAuth 和 BetterWright 链路仍需要在受控环境中完成端到端验证，不能仅根据适配器存在就视为已经达到发布标准。

当前 Prompt 文件位于 `src/agent/prompts/`，但 SDK 实现仍有对应的代码内 Prompt 构造逻辑。这是需要在 v0.2 收敛的过渡状态。

## 4. v0.2 总体目标

v0.2 必须达到以下目标：

- 真实 E2E 链路能够执行并产生可信结果。
- 非交互模式可以被任意外部调用方稳定使用。
- 每次执行都有独立、可追踪的报告。
- 零用例、结果缺失、解析失败或基础设施错误不会被误判为通过。
- Prompt 具有单一、可测试、可发布的加载机制。
- 行为变化可以通过集成测试、Evaluation 和小型 Benchmark 量化。
- 整个过程中不修改被测应用业务代码。

## 5. Phase 1：真实 E2E 闭环与结果可信度

### 5.1 目标

完成以下真实 E2E 链路：

```text
task-spec / Git Diff
        ↓
Requirement Analysis
        ↓
Test Plan
        ↓
BetterWright Exploration
        ↓
Playwright Test Generation
        ↓
Playwright Execution
        ↓
Failure Analysis
        ↓
Report
```

该链路只描述测试流程，不包含业务代码修复或调用方工作流编排。

### 5.2 前置条件

以下内容允许在首次运行前由用户或运行环境准备：

- 安装真实 Pi SDK 和 BetterWright 可选依赖。
- 完成 ChatGPT OAuth。
- 完成被测系统业务登录并准备浏览器 Session。
- 提供可启动或已启动的被测应用。

完成前置准备后，`verify --non-interactive` 执行期间不得等待人工输入。

### 5.3 报告历史

每次成功进入报告阶段的执行必须生成独立报告，推荐目录约定：

```text
.auto-e2e/reports/
├── runs/
│   └── <runId>/
│       ├── result.json
│       ├── summary.md
│       ├── playwright.json       # 启用且成功产出时
│       ├── junit.xml             # 启用且成功产出时
│       └── html/                 # 启用且成功产出时
└── latest/                       # 最近一次执行的兼容入口
```

`latest/` 可以是复制、指针或其他跨平台兼容实现，但其内容必须与最近一次运行一致。历史运行目录不得因下一次执行而被覆盖。

报告路径只能记录真实存在或确实由本次配置预期生成的产物。

### 5.4 结果契约

`result.json` 继续以 `TestResultSchema` 为权威来源。若增加 `runId`、Schema 版本或运行关联字段，必须同步更新：

- 领域 Schema 和类型。
- 单元测试与集成测试。
- README 和 `docs/usage.md`。
- `src/index.ts` 中受影响的公共导出。

必须保持稳定退出码，并满足：

- 测试全部通过才能返回成功。
- 存在失败测试时返回 TestsFailed。
- 零用例视为执行异常，不得视为通过。
- Playwright 结果文件缺失或无法解析时视为执行异常。
- 应用启动、认证、浏览器和报告错误使用对应的稳定错误类型。
- `--json` 模式下 stdout 只能包含最终 JSON。

### 5.5 失败分类

失败类别继续以 `src/domain/failure-category.ts` 中的 `FAILURE_CATEGORIES` 为唯一权威来源：

```text
product_defect
test_defect
environment_failure
data_failure
auth_failure
browser_failure
flaky
unknown
```

失败条目继续遵循 `FailureEntrySchema`，包含：

- `category`
- `message`
- `confidence`
- 可选的 `expected`
- 可选的 `actual`
- 可选的 `artifacts`

网络错误和超时是错误表现，不在本阶段新增为顶层失败类别。只有在真实样本证明现有分类无法稳定表达根因后，才能通过 Schema 变更流程调整枚举。

### 5.6 验收标准

- Mock 模式能够稳定完成离线闭环。
- 真实 Agent 与真实 BetterWright 至少完成一个受控项目试点。
- 非交互执行期间无需人工输入。
- 同一任务可以重复执行。
- 每次执行生成独立报告，并保留 `latest/` 兼容入口。
- 零用例、报告缺失和解析失败均不会报通过。
- 失败分类符合当前权威枚举。
- auto-e2e 不修改被测应用业务代码。
- auto-e2e 不调用或控制 Codex/Agent 工作流。

## 6. Phase 2：回归测试基础

### 6.1 目标

在调整 Prompt 和引入知识库前，先建立能够发现行为回退的测试基础。

建议结构：

```text
tests/
├── unit/
├── integration/
└── fixtures/
```

首批集成测试应覆盖：

- CLI 初始化和配置加载。
- `task-spec.json` 校验。
- `verify --changed`。
- Mock 模式完整 `verify`。
- Playwright 成功、失败、零用例和结果缺失。
- 报告历史与 `latest/`。
- JSON stdout 不被日志污染。
- 敏感数据不进入日志和报告。
- Prompt Loader 的正常与异常路径。

真实 OAuth 和真实浏览器测试不作为普通单元测试或默认本地验证的前置条件，应使用显式启用的受控集成测试。

### 6.2 验收标准

- 所有行为变更都有防回退测试。
- 核心 CLI 至少有一个从输入到报告的集成测试。
- Mock 测试不加载真实 Pi SDK 或 BetterWright。
- 测试不能把零用例视为成功。

## 7. Phase 3：Prompt 单一来源

### 7.1 目标

收敛现有四类模型调用：

```text
src/agent/prompts/
├── analyze-requirement.md
├── create-test-plan.md
├── generate-test.md
└── analyze-failure.md
```

当前 Explorer、Playwright Runner 和 Reporter 不直接调用模型，因此不创建无人消费的 `explorer.md`、`runner.md` 或 `report.md`。

### 7.2 加载机制

建立统一 Prompt Loader：

```text
选择内置模板或项目覆盖模板
        ↓
校验模板与变量
        ↓
安全填充输入
        ↓
调用 PiClient
        ↓
使用现有 Zod Schema 校验输出
```

要求：

- SDK 实现不得继续维护第二份大段 Prompt。
- Prompt 输入插值必须有测试。
- 缺少模板或必需变量时返回可操作错误。
- 模型输出仍必须经过 Zod Schema 或等价显式校验。
- 内置 Prompt 必须随 npm 包正确发布。
- 可以支持项目级 `.auto-e2e/prompts/` 覆盖。
- 修改项目级覆盖 Prompt 无需重新编译 auto-e2e。
- Evaluation 中应能记录模板版本或内容哈希。

### 7.3 验收标准

- 所有现有模型调用通过同一个 Prompt Loader。
- SDK 代码中不再拼接对应的大段业务 Prompt。
- 发布包包含运行所需的内置 Prompt。
- 内置模板缺失、覆盖模板非法和变量缺失都有测试。
- Prompt 修改不会绕过结构化输出校验。

## 8. Phase 4：Evaluation

### 8.1 目标

为每次执行保存可比较的度量记录：

```text
.auto-e2e/evaluation/
└── runs/
    └── <runId>/
        └── metrics.json
```

Evaluation 是本地文件能力，不引入数据库、Dashboard 或云端服务。

### 8.2 指标

首版指标：

- Acceptance Criterion Count
- Generated Test Count
- Covered Acceptance Criterion Count
- Passed Test Count
- Failed Test Count
- Skipped Test Count
- Total Duration
- Explorer Duration
- LLM Call Count
- LLM Retry Count
- Token Usage（供应商可提供时）

每个指标必须有稳定定义。无法获取的指标使用 `null` 或明确的 unavailable 状态，不得伪造为 `0`。

记录还应包含：

- `schemaVersion`
- `runId`
- `taskId`
- auto-e2e 版本
- Agent 实现、Provider 和模型标识
- BetterWright 实现和可获得的版本
- Prompt 版本或内容哈希

不得记录 Prompt 中的敏感原文、Cookie、Token、密码或页面敏感数据。

### 8.3 验收标准

- 每次进入报告阶段的执行产生一份独立 metrics 文件。
- 指标可以与对应 `result.json` 通过 `runId` 关联。
- 指标定义有单元测试。
- 不支持的 usage 数据不会被记录成虚假数值。

## 9. Phase 5：小型 Demo Benchmark

### 9.1 目标

建立小而确定性的 Benchmark，用于比较 Prompt、模型和 BetterWright 版本变化。

第一版不以“完整后台系统”和“20 个 Bug”为目标。优先覆盖 5～8 个可稳定观察的场景：

- 正常登录或已登录访问。
- 表单提交成功。
- 一个确定性的业务缺陷。
- 一个测试脚本缺陷。
- 一个认证或权限失败。
- 一个环境或浏览器失败。
- 搜索或分页中的边界场景。
- 零用例或报告缺失等执行器异常。

所有故意保留的缺陷必须有唯一 ID、复现条件、预期分类和对应自动化断言。

### 9.2 指标

Benchmark 至少报告：

- 已知缺陷召回率。
- 非缺陷场景误报数。
- 失败分类准确率。
- 生成测试可编译率。
- 生成测试实际执行率。
- 连续运行稳定性。

### 9.3 验收标准

- Benchmark 可以通过单一命令运行。
- 每个已知缺陷都有确定性 fixture 和预期结果。
- 连续运行次数、允许误差和通过阈值在 Benchmark 配置中明确声明。
- Benchmark 失败不会被普通单元测试静默忽略。
- Benchmark 报告能够关联模型、Prompt 和 BetterWright 版本。

## 10. Phase 6：Knowledge Base 实验

### 10.1 启动条件

只有在 Prompt 单一来源、Evaluation 和 Benchmark 已可用后，才开始 Knowledge Base。

Knowledge 文件必须有实际加载机制和评测用途。不得预先创建无人消费的 Markdown 文件。

### 10.2 首版范围

从 Benchmark 中选择有明确收益假设的少量主题，例如：

```text
knowledge/
├── login.md
├── table.md
└── pagination.md
```

加载机制必须定义：

- 根据什么输入选择知识文件。
- 多文件选择顺序和数量上限。
- 内容长度或 Token 预算。
- 项目级覆盖规则。
- 缺失、重复和非法引用的处理方式。
- 知识版本或内容哈希。

### 10.3 验收标准

- 支持确定性地引用一个或多个知识文件。
- 知识选择和注入过程有测试。
- 不会加载未选择的知识文件。
- 不会把敏感配置或页面数据写入知识文件。
- Benchmark 能证明引入知识后的收益或明确显示没有收益。

## 11. Phase 7：本地验证入口

### 11.1 首版范围

提供一个可重复执行的本地 Shell 命令，用于验证 v0.2 的基础质量和 Mock E2E 闭环。

```bash
./scripts/validate-local.sh
```

该脚本应按顺序执行：

1. 检查当前 Node.js 主版本是否满足项目要求。
2. 执行 `npm run typecheck`。
3. 执行 `npm test`。
4. 执行 `npm run build`。
5. 在隔离 fixture 中执行 Mock 模式的非交互 `verify`。
6. 校验退出码、JSON stdout 和本次生成的 `result.json`。

脚本不得自动安装全局依赖、修改被测应用业务代码、依赖真实 OAuth 或读取真实浏览器 Session。任一步失败时必须立即返回非零退出码。

### 11.2 验收标准

- 在已完成 `npm install` 的本地仓库中，只需运行一个命令即可完成基础验证。
- 脚本能够运行 Mock E2E 集成链路。
- 脚本失败时保留原始非零退出状态。
- JSON stdout 保持机器可读。
- 重复执行不会依赖上一次残留报告而误判成功。
- 脚本不要求真实 Agent、OAuth 或 BetterWright Session。

## 12. 禁止开发内容

除非后续有明确需求和单独设计，v0.2 不实现：

- Codex 或其他 Agent 工作流编排。
- 自动修复业务代码。
- Web UI 或 Dashboard。
- 数据库存储。
- 多用户和权限系统。
- 插件市场。
- 云端服务或 SaaS。
- MCP Server。
- 分布式执行。
- 可视化工作流编辑器。
- 业务测试管理平台。

## 13. 工程质量要求

所有新增代码必须：

- 使用 TypeScript、ES modules 和 strict mode。
- 避免 `any`；不可信数据先作为 `unknown` 校验。
- 遵守现有模块边界。
- 生产代码使用项目 Logger。
- 行为变化包含防回退测试。
- 不泄露密码、Token、Cookie 或浏览器 Session。
- 不手工修改 `dist/`。

仓库当前没有独立 ESLint 或 Prettier 配置。v0.2 的基础验证命令是：

```bash
npm run typecheck
npm test
```

涉及构建、CLI 产物、Prompt 资源、包导出或发布内容时，还必须运行：

```bash
npm run build
```

不得声称通过仓库中不存在的格式化或 Lint 工具。

## 14. 交付物

v0.2 完成时应根据实际实现交付：

```text
CHANGELOG.md
docs/
src/agent/prompts/
tests/integration/
tests/fixtures/
scripts/validate-local.sh
examples/demo-app/             # 仅在采用仓库内 Demo 方案时
```

运行时产生但不得提交敏感内容的产物包括：

```text
.auto-e2e/reports/runs/<runId>/
.auto-e2e/evaluation/runs/<runId>/metrics.json
benchmark report
```

是否提交 Benchmark 结果必须根据内容审查；包含页面数据、截图、Trace、视频或 Session 的结果不得提交。

## 15. v0.2 Completion Criteria

满足以下条件才认为 v0.2 完成：

- Mock E2E 闭环稳定通过。
- 真实 Pi SDK 与真实 BetterWright 完成至少一个受控项目试点。
- 增量和全量 Playwright 执行结果可信。
- 零用例、结果缺失和解析失败不会被判定为通过。
- 每次执行生成独立报告，并保留 `latest/` 兼容入口。
- `result.json` 符合权威 Schema，可供任意机器调用方读取。
- Prompt 通过单一加载机制维护并随发布包交付。
- 核心 CLI 有集成测试。
- Evaluation 和小型 Benchmark 能量化行为变化。
- 非交互执行在前置认证和 Session 已准备后无需人工输入。
- auto-e2e 不修改被测应用业务代码。
- auto-e2e 不感知、不编排、不影响 Codex 或其他 Agent 的工作。

达到上述标准后停止扩展功能，完成验证与发布评审。
