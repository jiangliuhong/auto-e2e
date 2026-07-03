# 路线图

## 阶段 1 — 项目基础

目标:建立架构、CLI、接口和存储。

交付物:

- TypeScript 项目搭建
- Commander.js CLI
- ESM 配置
- Runtime 接口
- `.auto-e2e/` 存储服务
- init 命令
- doctor 命令

命令:

```bash
auto-e2e init
auto-e2e doctor
```

---

## 阶段 2 — Scanner

目标:发现项目结构。

交付物:

- 包管理器检测
- 框架检测
- 路由扫描
- data-testid 扫描
- app-map.json
- selector-map.json
- codex-context.md

命令:

```bash
auto-e2e scan
```

---

## 阶段 3 — Environment

目标:准备本地应用环境。

交付物:

- dev server 启动
- 就绪探针
- 端口检查
- 清理
- storageState 占位

命令:

```bash
auto-e2e prepare
```

---

## 阶段 4 — Observer

目标:通过结构化输出让浏览器页面对 Agent 可见。

交付物:

- 观察 URL
- 截图
- DOM 快照
- 控制台采集
- 网络采集
- 元素提取
- 推荐选择器生成

命令:

```bash
auto-e2e observe --url /login
```

---

## 阶段 5 — Executor ✅

目标:通过 Runtime 运行 Playwright。

交付物:

- 运行全部 specs
- 运行指定 spec
- 收集 JSON 报告
- 收集 trace/截图/视频引用

命令:

```bash
auto-e2e run
auto-e2e run --spec e2e/specs/login.spec.ts
```

---

## 阶段 5.5 — 文本用例 → Spec 生成指令包 ✅

目标:让外部编码 Agent 能从一条文本用例出发,产出可执行的标准 Playwright spec。

交付物:

- `generate` 命令:接收文本用例(`--case` / `--case-file`),把它和项目上下文(路由/选择器)+ Playwright 编写规范组装为「Spec 生成指令包」
- `.auto-e2e/spec-briefs/<name>.md` 产物
- 未执行 scan 时自动触发 scan 补充上下文

> Runtime 不做推理、不调用 LLM。spec 代码由外部 Agent 依据指令包编写,之后用 `run --spec` 执行。

命令:

```bash
auto-e2e generate --name login --case "用户登录后应跳转到 /dashboard"
# 编码 Agent 据指令包编写 e2e/login.spec.ts
auto-e2e run --spec e2e/login.spec.ts
```

---

## 阶段 6 — Feedback

目标:把执行结果转换为 Agent 可读的反馈。

交付物:

- run-result.json
- failure-summary.md
- 失败测试提取
- 产物路径提取
- 控制台/网络错误摘要

命令:

```bash
auto-e2e report
```

---

## 阶段 7 — 稳定化

目标:提升可靠性和开发体验。

交付物:

- 各模块的测试
- 文档更新
- 示例项目
- CI 工作流
- npm 包发布设置

---

## 阶段 8 — 高级 Runtime

未来可能的能力:

- Docker 环境的 provider
- 远程浏览器 provider
- MCP 服务器模式
- 无障碍测试
- 视觉回归
- 网络 mock
- 测试数据 fixtures
- CI 摘要报告器
