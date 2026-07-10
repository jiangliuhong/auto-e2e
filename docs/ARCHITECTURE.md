# Auto E2E Runtime 架构

## 愿景

Auto E2E **不是**一个 AI agent。

它是一个面向浏览器自动化的 **Agent Runtime**。

Runtime 为 Codex、Claude Code、Cursor、OpenCode 等编码 Agent 提供一个稳定、结构化、确定性的执行环境。

Runtime 绝不执行推理。

推理始终由外部 Agent 完成。

Runtime 只提供:

- Environment(环境)
- Observation(观察)
- Execution(执行)
- Feedback(反馈)

---

## 设计原则

### 单一职责

每个模块只应有一个职责。

避免“上帝对象”。

避免超过几百行的模块。

### 仓库优先

业务逻辑不得依赖于 CLI。

业务逻辑不得直接依赖 Playwright。

CLI 只应编排 Runtime API。

### Runtime 优先

Runtime 是项目的核心。

```text
CLI
│
▼
Runtime
├── Environment
├── Scanner
├── Observer
├── Executor
├── Feedback
└── Storage
```

---

## Runtime 生命周期

```text
Prepare Environment
        │
        ▼
Scan Project
        │
        ▼
Observe Application
        │
        ▼
Execute Test
        │
        ▼
Collect Artifacts
        │
        ▼
Generate Structured Feedback
```

任何模块都不应跳过这一生命周期。

---

## 模块职责

### Environment

负责:

- 启动项目
- 停止项目
- 重启项目
- 等待直到就绪
- 健康检查
- 存储状态
- 测试 fixtures

不含任何浏览器逻辑。

### Scanner

负责项目发现。

支持的框架:

- React
- Next.js
- Vue
- Vite

输出:

- app-map.json
- selector-map.json
- codex-context.md

不依赖 Playwright。

### Observer

负责应用观察。

产出结构化信息,而不仅是截图。

应当收集:

- DOM 快照
- 无障碍树
- URL
- 标题
- 按钮
- 输入框
- 表格
- 链接
- 对话框
- 推荐的选择器
- 控制台消息
- 网络请求
- 截图

Observer 绝不执行断言。

### Executor

负责运行 Playwright。

支持:

- run
- runSpec
- runSuite
- runTag

收集:

- Trace
- 截图
- 视频
- HTML 报告
- JSON 报告

不做业务分析。

### Feedback

负责把执行结果转换为结构化数据。

输出:

- run-result.json
- failure-summary.md

未来输出:

- dom-diff.json
- network-summary.json

Feedback 必须是机器可读的。

### Storage

负责 Runtime 持久化。

Runtime 生成的所有内容都应存放在:

```text
.auto-e2e/
```

绝不要把运行时产物散落在整个项目中。

### Skill(用例契约层)

负责**发现项目 skill、校验用例契约、生成用例编写指令包**。

- skill 按编码 Agent 平台存放在 `.codex` / `.claude` / `.zcode` 下的 `skills/<name>/SKILL.md`;平台由 `config.agentPlatform` 决定,**安装时由 `auto-e2e init --agent-platform` 选择**,不写死进核心。
- 用例契约是确定性的 Markdown 结构(Target / Preconditions / Steps / Assertions / Network Expectations / Stability Notes / Write Operations),解析与校验均为纯函数,**不调用 LLM、不做语义猜测**。
- `skill generate` 只做「组装」:把 skill 规则 + target + 项目上下文 + 契约模板拼成一份「用例编写指令包」(`.auto-e2e/case-briefs/<slug>.md`),交由外部 Agent 编写最终用例 —— 完全对齐 `generate` 的「组装不推理」模式。

Skill 模块职责隔离:发现(skill-reader)、解析(case-contract)、校验(case-validator)、渲染(case-brief)各为独立纯函数模块。

---

## Provider 架构

所有实现都应当是可替换的。

示例:

BrowserProvider:

- Playwright
- Chrome,未来

EnvironmentProvider:

- Local Node
- Docker,未来
- 远程,未来

ReportProvider:

- HTML
- JSON
- JUnit

绝不要把 provider 实现硬编码进 Runtime。

---

## 数据流

```text
CLI
 │
 ▼
Runtime
 │
 ├── Environment
 ├── Scanner
 ├── Observer
 ├── Executor
 └── Feedback
 │
 ▼
.auto-e2e
```

所有 Agent 都从 `.auto-e2e` 消费 Runtime 输出。

---

## 未来扩展

- 多浏览器支持
- Docker Runtime
- 远程浏览器
- 并行执行
- 视觉回归
- 无障碍测试
- API 录制
- 测试数据管理
- MCP 集成
- CI/CD 集成

---

## 非目标

Runtime 绝不应:

- 调用 LLM
- 依赖 OpenAI 或 Anthropic
- 执行推理
- 修改业务代码
- 猜测应用行为

这些职责属于外部编码 Agent。
