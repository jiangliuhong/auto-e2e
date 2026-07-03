# AGENT_INIT_PROMPT.md

# 项目目标

构建 **auto-e2e**,一个**面向 Playwright 的 Agent Runtime**。

本项目不绑定到任何特定的编码 Agent。

它应当能良好地与以下工具配合:

* Codex
* Claude Code
* Cursor
* OpenCode
* GitHub Copilot Coding Agent
* 任何未来的编码 Agent

Runtime 应当为浏览器 E2E 自动化提供一个稳定、确定、结构化的环境。

---

# 核心概念

外部编码 Agent 负责推理。

Runtime 负责:

* Environment(环境)
* Observation(观察)
* Execution(执行)
* Feedback(反馈)
* Storage(存储)

Runtime 绝不能依赖于特定的 LLM provider 或编码 Agent。

---

# 本项目是什么

auto-e2e 是:

* 一个 Playwright Runtime
* 一个浏览器观察框架
* 一个结构化的 E2E 执行层
* 一个机器可读的反馈生成器
* 一个帮助编码 Agent 编写、运行和修复 E2E 测试的工具

---

# 本项目不是什么

auto-e2e 不是:

* 一个 AI Agent
* 一个测试生成模型
* 一个仅针对 Codex 的工具
* 一个仅针对 Claude 的工具
* 一个围绕某个特定助手的封装
* 一个默认调用 OpenAI、Anthropic 或任何 LLM 的工具

---

# 要求的技术栈

使用:

* Node.js >= 20
* TypeScript
* ESM
* pnpm
* Commander.js
* Playwright
* execa
* fs-extra
* zod
* fast-glob

---

# 架构

采用 Runtime 优先的架构。

建议结构:

```text
src/
  cli/
  runtime/
    environment/
    observer/
    executor/
    feedback/
    storage/
  scanner/
  reporter/
  playwright/
  core/
  utils/
```

CLI 只能调用 Runtime API。

不要把业务逻辑放进 CLI 命令中。

---

# Runtime 模块

## Environment

负责:

* 启动应用
* 停止应用
* 重启应用
* 等待应用就绪
* 健康检查
* 存储状态
* fixtures

## Observer

负责:

* 打开页面
* 收集 DOM 快照
* 收集无障碍树
* 收集标题和 URL
* 收集按钮、输入框、链接、表格、对话框
* 收集控制台消息
* 收集网络请求
* 截图
* 推荐选择器

Observer 不得执行测试断言。

## Executor

负责:

* 运行 Playwright 测试
* 运行全部测试
* 运行单个 spec
* 按标签或套件运行
* 收集 trace、screenshot、video、HTML 报告、JSON 报告

## Feedback

负责:

* 解析 Playwright 结果
* 生成结构化失败报告
* 生成 Markdown 摘要
* 提取可能的失败原因
* 关联截图和 trace

## Storage

负责所有 Runtime 状态,位于:

```text
.auto-e2e/
```

---

# CLI 命令

优先实现以下命令:

```bash
auto-e2e init
auto-e2e scan
auto-e2e prepare
auto-e2e observe --url /login
auto-e2e run
auto-e2e run --spec e2e/specs/login.spec.ts
auto-e2e report
auto-e2e doctor
```

---

# Runtime 输出

所有生成的 Runtime 文件必须存放在:

```text
.auto-e2e/
```

预期文件:

```text
.auto-e2e/
  app-map.json
  selector-map.json
  codex-context.md
  agent-context.md
  run-result.json
  failure-summary.md
  observations/
  reports/
  history/
```

优先使用 `agent-context.md` 作为通用上下文文件。

`codex-context.md` 可以仅作为向后兼容的别名保留。

---

# Agent 兼容性规则

Runtime 应当以任何编码 Agent 都能读取的格式输出信息:

* JSON
* Markdown
* 纯文本日志

避免使用依赖特定平台的格式。

不要假设 Agent 能访问浏览器 UI。

不要假设 Agent 能以视觉方式检查截图。

尽可能提供结构化的文本数据。

---

# 开发阶段

## 阶段 1

* 项目搭建
* CLI 骨架
* Runtime 接口
* 存储布局
* 基础文档

## 阶段 2

* Environment 实现
* Scanner 实现
* 配置加载
* 项目检测

## 阶段 3

* Observer 实现
* DOM 快照
* 无障碍快照
* 控制台收集
* 网络收集
* 截图采集
* 选择器推荐

## 阶段 4

* Executor 实现
* Playwright runner 集成
* JSON 报告解析
* 产物收集

## 阶段 5

* Feedback 实现
* failure-summary.md
* run-result.json
* 面向 Agent 的建议

## 阶段 6

* 测试
* 示例
* 文档
* Provider 扩展指南

---

# 编码规则

使用严格模式的 TypeScript。

避免 `any`。

优先使用接口。

保持模块小型化。

不要创建大文件。

在有帮助的地方使用依赖注入。

面向抽象编程,而非具体实现。

不要在整个 Runtime 中硬编码 Playwright。

---

# 测试规则

为每个模块添加测试。

优先使用确定性测试。

避免任意的 sleep。

避免不稳定的浏览器测试。

将单元测试与 E2E 测试分开。

---

# 重要设计约束

本 Runtime 必须保持独立于所有特定的 AI 工具。

不要在实现层 API 中出现 Codex、Claude、Cursor 或 OpenCode 的名称,除非该功能明确是兼容性适配器。

使用通用名称:

* `agentContext`
* `agentPrompt`
* `agentReport`
* `runtimeResult`

避免工具专有名称:

* `codexContext`
* `claudeContext`
* `cursorReport`

---

# 最终目标

构建一个长期可维护的**面向 E2E 测试的 Agent Runtime**。

Runtime 应当通过提供以下能力,让任何编码 Agent 都更容易进行浏览器自动化:

* 稳定的环境控制
* 丰富的页面观察
* 确定性的测试执行
* 结构化的反馈
* 持久化的运行时状态
