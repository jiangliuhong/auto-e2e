# Changelog

## Unreleased

- 新增 `.auto-e2e/specs/*.spec.json` 多文件用例约定；不再读取旧版 `.auto-e2e/task-spec.json`。
- 每个用例文件使用独立 BetterWright session 运行，SQLite、JSON 快照、CLI 和 Web UI 展示汇总与逐用例报告。

## 0.3.0

- Breaking：删除 Pi、原生 Playwright Explorer、测试生成与 Playwright Runner 产品链路。
- CLI 收敛为 `doctor`、`run`、`list`、`show`、`serve`。
- BetterWright CLI 负责真实浏览器验收，所有 AC 必须返回结构化结论与 proof。
- 使用 SQLite 保存需求、运行、验收标准和 artifact 元数据。
- 新增只读本地验收历史与 proof Web 页面。
- 公共退出码收敛为 `0`、`1`、`2`、`3`。

## 0.2.0

- 增加不可变运行历史、`runId` 和 TestResult Schema v2。
- 增加 Prompt 单一加载、项目覆盖、SDK 校验重试与遥测。
- 增加 Evaluation Metrics、可选 Knowledge Base 和最小 Demo Benchmark。
- 增加 `./scripts/validate-local.sh` 本地验证入口。
- 明确 auto-e2e 只处理 E2E 测试，不编排调用方或修改业务代码。
