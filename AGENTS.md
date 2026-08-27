# auto-e2e Agent Development Guide

auto-e2e 是基于 BetterWright 的本地需求验收运行器。它不生成 Playwright 测试、不调用 Pi SDK，也不修改被测应用业务代码。

## 权威来源

- 配置：`src/config/config-schema.ts`
- 任务规格：`src/domain/task-spec.ts`
- 验收运行结果：`src/domain/acceptance-run.ts`
- 退出码：`src/runtime/exit-codes.ts`
- CLI：`src/cli.ts` 与 `src/commands/`

## 架构边界

```text
src/
├── acceptance/  # 需求读取、BetterWright CLI、运行编排、SQLite 历史
├── commands/    # doctor/run/list/show/serve
├── config/      # .auto-e2e.yaml 加载与校验
├── domain/      # Zod 领域契约
├── runtime/     # 日志、执行上下文、退出码
├── server/      # 本地只读报告 UI 与 HTTP API
├── cli.ts
└── index.ts
```

- BetterWright 调用只发生在 `acceptance/betterwright-cli.ts`。
- CLI 和 HTTP 层只负责编排，不解析模型自然语言。
- BetterWright 最终结果必须通过 Zod 校验并完整覆盖全部 AC 后才能落库。
- SQLite 保存结构化元数据；截图等二进制产物保存到文件系统。
- `serve` 默认只监听 `127.0.0.1`，artifact 路径必须阻止目录穿越。
- 密码、Token、Cookie、OAuth 信息和 BetterWright Handoff 控制令牌不得写入配置、数据库或报告。

## CLI 契约

公共命令只有：`doctor`、`run`、`list`、`show`、`serve`、`skill`。`skill install/status` 只操作目标项目的 `.codex/skills/auto-e2e-acceptance`，不得写入用户全局 Skill 目录。

退出码：

- `0`：全部通过
- `1`：存在验收失败
- `2`：环境、配置、登录或浏览器阻塞
- `3`：工具自身异常

`--json` 模式下 stdout 只能包含最终 JSON；进度和日志写入 stderr。

## 工程约束

- Node.js >= 22.13.0、TypeScript、ES modules、strict mode、async/await。
- 外部数据先视为 `unknown`，经过 Zod 或显式收窄后使用。
- 不手工编辑 `dist/`；`npm run build` 会清理并重新生成。
- 新增依赖前优先考虑 Node.js 标准库；BetterWright 通过 CLI 适配器调用。
- 行为变更必须包含回归测试。

完成代码变更后运行：

```bash
npm run typecheck
npm test
npm run build
```
