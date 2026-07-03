# Auto E2E 文档集

本文档集用于构建 **auto-e2e**,一个面向 Playwright 的 Agent Runtime。

本项目的目标不是构建一个 AI agent,而是构建一个确定性的运行时层,供 Codex、Claude Code、Cursor、OpenCode 等编码 Agent 用于观察、执行和分析 E2E 测试。

## 文档

- `CODEX_INIT_PROMPT.md` — 使用 Codex 初始化项目的提示词。
- `ARCHITECTURE.md` — Runtime 架构与模块职责。
- `AGENTS.md` — 面向编码 Agent 的开发规则。
- `RUNTIME_SPEC.md` — Runtime 公共 API 契约。
- `PROVIDER_GUIDE.md` — Provider 扩展指南。
- `OUTPUT_SPEC.md` — Runtime 输出文件格式。
- `ROADMAP.md` — 建议的分阶段实施路线图。

## 核心理念

```text
External Coding Agent
        ↓
auto-e2e Runtime
        ↓
Playwright / Browser / Project Environment
```

Agent 负责思考。

Runtime 负责观察、执行和报告。
