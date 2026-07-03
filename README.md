# Auto E2E

面向 Playwright 的 **Agent Runtime**。

本项目的目标不是构建一个 AI agent,而是构建一个确定性的运行时层,供 Codex、Claude Code、Cursor、OpenCode 等编码 Agent 用于观察、执行和分析 E2E 测试。

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

## 安装

```bash
# 作为项目依赖安装
pnpm add -D auto-e2e @playwright/test

# 或全局安装 CLI
pnpm add -g auto-e2e
```

> 要求 Node.js >= 20。

## 快速开始

```bash
# 1) 初始化 .auto-e2e/ 目录与默认 config.json
auto-e2e init

# 2) 检查环境是否就绪(Node / 包管理器 / Playwright / 浏览器)
auto-e2e doctor

# 3) 扫描项目结构,生成 app-map / selector-map / agent-context
auto-e2e scan

# 4) 启动 dev server 并等待就绪
auto-e2e prepare

# 5) 执行 Playwright 测试(全部或指定 spec)
auto-e2e run
auto-e2e run --spec e2e/login.spec.ts
```

所有 Runtime 产物统一写入 `.auto-e2e/`(详见 `docs/OUTPUT_SPEC.md`)。

## 已实现的能力

| 能力                   | 命令                | 状态            |
| ---------------------- | ------------------- | --------------- |
| 项目初始化             | `auto-e2e init`     | ✅              |
| 环境自检               | `auto-e2e doctor`   | ✅              |
| 项目扫描               | `auto-e2e scan`     | ✅              |
| 环境准备(dev server)   | `auto-e2e prepare`  | ✅              |
| 文本用例 → Spec 指令包 | `auto-e2e generate` | ✅              |
| 页面观察               | `auto-e2e observe`  | ⏳ 路线图阶段 4 |
| 测试执行               | `auto-e2e run`      | ✅              |
| 反馈报告               | `auto-e2e report`   | ⏳ 路线图阶段 6 |

## 开发

```bash
pnpm install        # 安装依赖
pnpm typecheck      # TypeScript 类型检查
pnpm test           # 运行单元测试(vitest)
pnpm build          # 编译到 dist/
pnpm dev            # 直接用 tsx 运行 CLI(开发模式)
pnpm format         # 用 Prettier 格式化
```

### 编程式使用

Runtime 也可作为库使用:

```ts
import { createRuntime } from 'auto-e2e'

const runtime = createRuntime({ projectRoot: process.cwd() })

// 扫描项目
const scan = await runtime.scan()
console.log(scan.appMap.framework, scan.selectorMap.items.length)

// 检查环境
const doctor = await runtime.doctor()
console.log(doctor.ok, doctor.checks)

// 执行 Playwright 测试
const run = await runtime.run({ spec: 'e2e/login.spec.ts' })
console.log(run.status, run.summary, run.failures)
```

## 文档

- `docs/USAGE.md` — CLI 使用指南:如何初始化、创建用例并执行。
- `docs/AGENT_INIT_PROMPT.md` — 初始化项目的完整说明(目标、技术栈、架构、阶段)。
- `docs/ARCHITECTURE.md` — Runtime 架构与模块职责。
- `AGENTS.md` — 面向编码 Agent 的开发规则。
- `docs/RUNTIME_SPEC.md` — Runtime 公共 API 契约。
- `docs/PROVIDER_GUIDE.md` — Provider 扩展指南。
- `docs/OUTPUT_SPEC.md` — Runtime 输出文件格式。
- `docs/ROADMAP.md` — 分阶段实施路线图。

## 架构

Runtime 优先:`CLI` 仅编排 `Runtime` API,业务逻辑不放在 CLI;模块面向接口编程,Provider 可替换。

```text
src/
  cli/        CLI 编排(仅调用 Runtime API)
  runtime/    核心:environment / observer / executor / feedback / storage / doctor
  scanner/    项目扫描:框架/路由/data-testid 检测
  core/       共享接口与领域模型(无运行时逻辑)
  utils/      工具函数
```
