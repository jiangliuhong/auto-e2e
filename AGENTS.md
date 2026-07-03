# Auto E2E 开发规则

本仓库专为编码 Agent 设计。

在做任何修改之前,请完整阅读本文档。

---

## 项目目标

为 Playwright 构建一个 Agent Runtime。

Runtime 负责:

- Environment(环境)
- Observation(观察)
- Execution(执行)
- Feedback(反馈)

Runtime 不负责 AI 推理。

---

## 开发流程

始终遵循以下流程:

1. 理解当前架构。
2. 保持模块边界清晰。
3. 一次只实现一个能力。
4. 添加测试。
5. 更新文档。

不要把多个无关的改动混在一个任务里。

---

## 架构规则

- 永远不要绕过 Runtime。
- 永远不要把业务逻辑放进 CLI。
- 永远不要让模块之间紧耦合。
- 始终面向接口编程。
- 优先使用依赖注入。
- Provider 必须可替换。

---

## 目录规则

CLI 代码位于:

```text
src/cli
```

Runtime 位于:

```text
src/runtime
```

共享模型:

```text
src/core
```

工具:

```text
src/utils
```

Playwright 集成:

```text
src/playwright
```

项目扫描:

```text
src/scanner
```

报告:

```text
src/reporter
```

不要创建大型杂项目录。

---

## Runtime 规则

- Environment 只管理环境。
- Observer 只负责观察。
- Executor 只负责执行。
- Feedback 只分析执行结果。
- Storage 只负责持久化运行时状态。

保持职责隔离。

---

## 编码规则

- 使用 TypeScript 严格模式。
- 避免 `any`。
- 优先使用接口而非具体实现。
- 使用有意义的命名。
- 保持文件聚焦。
- 避免深层继承。
- 优先使用组合。

---

## 测试规则

- 每个新功能都应包含测试。
- 测试应当是确定性的。
- 避免不稳定的测试。
- 避免不必要的等待。
- 优先使用显式断言。

---

## Playwright 规则

优先使用:

- `getByRole`
- `getByLabel`
- `getByPlaceholder`
- `data-testid`

避免使用:

- `nth-child`
- 生成的 CSS 类名
- 过长的 CSS 选择器
- 任意的超时值

尽可能使用 `storageState`。

---

## Runtime 输出

Runtime 产物仅属于:

```text
.auto-e2e/
```

预期输出包括:

- app-map.json
- selector-map.json
- codex-context.md
- run-result.json
- failure-summary.md
- observations/

不要把运行时文件写到其他地方。

---

## 变更策略

实现功能时:

- 尽量缩小改动范围。
- 复用现有抽象。
- 避免破坏公共接口。
- 在可行时保持向后兼容。

仅在确实能提升可维护性时才进行重构。

---

## Agent 行为

编写代码之前:

- 阅读 `ARCHITECTURE.md`。
- 尊重模块边界。
- 在创建新抽象之前先搜索现有抽象。

完成之前:

- 运行测试。
- 检查格式。
- 验证 TypeScript 编译。
- 如果行为发生变化,更新文档。

---

## 长期原则

优先为可维护性优化,而非为速度。

优先选择可扩展性,而非捷径。

Runtime 应当保持独立于任何特定的 AI 模型或编码助手。

每个功能都应让 Runtime 变得更可复用、更可观察、更确定。
