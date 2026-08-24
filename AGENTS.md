# auto-e2e Agent Development Guide

本文定义 AI Agent 在本仓库中工作的工程约束。规则以当前代码为基础；当本文与可执行代码、Zod Schema 或测试冲突时，应先核实代码，并在同一次变更中更新本文，不能为了迎合本文而盲目重构。

## 1. 项目定位

auto-e2e 是一个 AI 驱动的 E2E 测试生成与执行 CLI。当前链路包括：

1. 读取并校验 `task-spec.json`。
2. 分析需求和代码变更。
3. 生成结构化测试计划。
4. 使用 Playwright 探索页面并收集证据。
5. 生成 `@playwright/test` 测试。
6. 使用 Playwright 执行测试。
7. 分析失败并生成机器可读报告。

测试代码生成属于项目核心能力。项目不负责生成或修改被测应用的业务代码。

当前默认使用 Mock Agent 和 Mock Browser，使主链路可以离线运行。真实 AI 通过 Pi SDK 接入，真实浏览器直接基于 Playwright（支持本机 Google Chrome）接入。

## 2. 权威来源

不要在文档中复制容易过期的契约。以下代码是对应内容的权威来源：

- 配置结构：`src/config/config-schema.ts`
- 默认配置：`src/config/defaults.ts`
- 任务规格：`src/domain/task-spec.ts`
- 测试计划：`src/domain/test-plan.ts`
- 探索结果：`src/domain/explore-result.ts`
- 测试结果：`src/domain/test-result.ts`
- 失败分类：`src/domain/failure-category.ts`
- 退出码：`src/runtime/exit-codes.ts`
- CLI 命令与参数：`src/cli.ts` 和 `src/commands/`

修改上述契约时，应同步更新相关测试、README、`docs/usage.md` 和 `examples/AGENTS.md`。不要维护第二份手写枚举或 Schema。

## 3. 当前源码结构

源码位于 `src/`，当前模块职责如下：

```text
src/
├── agent/          # PiClient 接口、Mock/SDK 实现、需求与计划生成
│   └── prompts/    # 当前 Prompt 模板文件
├── browser/        # 页面探索、证据收集、会话和原生 Playwright 适配器
├── commands/       # CLI 用例编排
├── config/         # 配置 Schema、默认值、加载和写入
├── domain/         # 跨模块共享的领域模型与 Zod Schema
├── git/            # Git Diff 读取与变更分析
├── playwright/     # 测试生成、Playwright 执行和结果解析
├── project/        # 被测项目检测、启动和健康检查
├── report/         # 失败分析与统一报告生成
├── runtime/        # 执行上下文、日志、退出码和命令包装
├── cli.ts          # CLI 入口
└── index.ts        # 库导出入口
```

不要仅为匹配理想化目录名称而移动现有模块。目录级重构必须有明确收益，并同步修复导入、测试、文档和公共导出。

## 4. 模块边界

必须遵守以下边界：

- `domain/` 不依赖具体 AI、浏览器、Playwright 或 CLI 实现。
- `agent/` 是模型能力入口。业务流程不得直接调用某个模型 SDK。
- `browser/` 负责页面探索、登录、DOM/可访问性快照、截图和会话。
- `playwright/` 负责生成与执行测试；生成器不得直接控制浏览器。
- `report/` 消费结构化执行结果，不负责启动浏览器或被测应用。
- `commands/` 是编排层，可以组合各模块，但不应承载可复用的核心算法。
- 浏览器交互只能发生在 `browser/` 或 Playwright Runner 中。需求分析和测试计划阶段不得打开页面。
- 禁止循环依赖。

新增具有业务语义、供应商绑定、I/O 副作用或多实现需求的能力时，应使用接口和适配器。纯工具库（例如 Zod、YAML 解析）可以直接使用，不需要为“可替换”机械地增加包装层。

优先使用组合、工厂和小型函数；避免深继承和无实际替换价值的抽象。

## 5. AI 与 Prompt

所有模型调用必须通过 `PiClient` 接口，具体实现由工厂选择。不要从命令、报告或 Playwright Runner 中直接调用 Pi SDK 或其他模型服务。

当前 Prompt 模板位于 `src/agent/prompts/`，但 `src/agent/sdk-pi-client.ts` 仍包含对应的动态 Prompt 构造函数。这是现有过渡状态，不应继续增加第三份副本。

修改 Prompt 行为时：

1. 保持模板与当前 SDK 构造逻辑一致。
2. 为输入插值和结构化输出校验补充测试。
3. 优先逐步收敛到单一模板来源，但不要在无关任务中顺带进行大规模迁移。
4. 模型输出必须经过现有 Zod Schema 或等价的显式校验后才能进入后续流程。

可复用的测试知识未来可以独立于 Prompt 管理；在形成实际加载机制前，不要创建无人消费的 `knowledge/` 文件。

## 6. 配置与路径

目标项目配置从 `.auto-e2e/config.yaml` 读取，并通过 `AutoE2EConfigSchema` 校验。默认值集中在配置模块。

- 不要硬编码用户机器上的绝对路径。
- 项目相关路径通过配置或 `ExecutionContext` 解析。
- 稳定的内部文件名可以集中定义，但不要在多个模块重复魔法字符串。
- 密码、Token、Cookie 等敏感信息不得写入配置或报告。
- `generation.allowSourceModification` 当前固定为 `false`；不得通过其他路径绕过它修改被测业务代码。

## 7. 浏览器与执行器

Playwright Explorer 当前用于真实页面探索、业务登录、页面理解、证据收集和会话管理。浏览器适配器中不得放置需求分析、测试规划或失败决策逻辑。

Playwright 是当前默认执行器，生成的测试使用 `@playwright/test`。执行参数应通过 `src/playwright/reporter-config.ts` 和配置模块构造，不要把仅属于 Playwright 配置文件的选项错误地作为 CLI 参数传递。

执行结果必须基于 Playwright 的真实退出状态和结果文件判断。零用例、结果文件缺失或解析失败不得被静默判定为通过。

## 8. 报告、失败分类与错误

一次成功进入报告阶段的执行当前应产生：

```text
.auto-e2e/reports/latest/
├── result.json
├── summary.md
└── html/            # Playwright HTML reporter 启用且成功产出时
```

JUnit、截图、Trace 和视频只在对应 reporter/配置和执行场景产生。报告中记录的产物路径必须指向真实存在或确实预期由当前执行生成的文件。

`result.json` 必须符合 `TestResultSchema`。当前失败分类仅以 `FAILURE_CATEGORIES` 为准：

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

不要在代码或文档中使用未进入该枚举的分类。

CLI 可预期错误使用 `AutoE2EError`，至少携带稳定退出码和可操作的消息；底层原始错误通过 `cause` 保留。测试失败分析使用 `FailureEntrySchema`，包含分类、消息、置信度以及可选的 expected、actual 和 artifacts。

不要把原始异常堆栈、凭据、Cookie、Token 或页面敏感数据直接写入用户报告。

## 9. 日志与 CLI 输出

生产代码使用项目 Logger，不使用 `console.log`。

CLI 边界允许为协议需要直接写入 `process.stdout` 或 `process.stderr`：

- `--json` 模式下，stdout 只能包含最终 JSON。
- 日志和人类可读提示不得污染 JSON stdout。
- debug、info、warn、error 和 silent 行为以 `src/runtime/logger.ts` 为准。

不要依赖控制台文本作为稳定的机器接口；机器调用方应使用退出码和 `result.json`。

## 10. TypeScript 与代码组织

- 使用 TypeScript、ES modules、strict mode 和 async/await。
- 避免 `any`；外部不可信数据先视为 `unknown`，再校验或收窄。
- 避免 callback hell、重复魔法字符串和无说明的魔法数字。
- 一个模块保持单一主要职责。
- 文件超过约 300 行时应评估拆分，但行数不是机械验收条件；拆分必须改善职责边界。
- 不要手工编辑 `dist/`。修改 `src/` 后由构建命令生成产物。
- 公共 API 变化应检查并更新 `src/index.ts`。

仓库当前没有独立 ESLint/Prettier 配置，`npm run lint` 实际等同类型检查。不要声称已经通过不存在的格式化或 lint 工具，也不要仅为格式化而擅自引入新依赖。

## 11. 测试与验证

行为变更必须包含能够防止该行为回退的测试。优先在 `tests/unit/` 中覆盖纯逻辑和适配器边界；涉及多个模块、真实子进程或文件产物时，再按风险增加集成测试。

代码变更完成后至少运行：

```bash
npm run typecheck
npm test
```

涉及构建、包导出、Prompt 资源或 CLI 产物时，还应运行：

```bash
npm run build
```

纯文档变更无需运行完整测试，但必须检查路径、命令、枚举和文件名是否与代码一致。不要为了让测试通过而修改被测业务语义，也不要把零用例当作成功验证。

## 12. 安全与依赖

不得向 Git 提交：

- OAuth Token
- API Key
- 密码
- Cookie 或浏览器 Session
- 包含敏感数据的截图、Trace、视频或报告

新增依赖前确认：

1. 现有依赖或 Node.js 标准库是否已经能解决问题。
2. 依赖是否仍在维护并与 Node.js 22 / ESM 兼容。
3. 它属于必需依赖、开发依赖还是可选适配器依赖。
4. 是否显著增加安装、构建或运行成本。

真实 Pi SDK 当前属于可选依赖；Mock 路径不应被迫加载它。适合延迟加载的外部实现应继续保持延迟加载。

## 13. 文档与变更范围

- README 描述用户可见能力和快速开始。
- `docs/usage.md` 描述详细用法与输出契约。
- `docs/plan.md`、`docs/NEXT_PHASE.md` 等规划文档不等于当前已实现行为。
- `examples/AGENTS.md` 是 auto-e2e 使用方的 Agent 集成示例，与本文件的仓库开发规则用途不同。

只修改完成当前任务所需的内容。不要顺带实现规划文档中的未来功能，也不要把未来目标描述成现有能力。

Pull Request 或交付说明应根据实际变更包含：

- 为什么修改
- 修改了什么
- 验证结果
- 兼容性或未覆盖风险（如有）

## 14. 当前范围外

除非用户明确要求且有单独设计，当前不实现：

- 云服务或 SaaS 平台
- 多租户
- 插件市场
- 可视化工作流编辑器
- 业务测试管理平台
- 自动修改被测应用业务代码

## 15. 决策优先级

发生取舍时按以下顺序判断：

1. 安全与数据保护
2. 正确性
3. 稳定性
4. 可维护性
5. 可替换性
6. 性能
7. 新功能数量

在不确定时，选择范围更小、行为更明确、容易测试且与当前架构一致的实现。不要用“更聪明”的抽象替代清晰、可验证的代码。
