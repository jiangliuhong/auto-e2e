# Changelog

## 0.3.3

- 修复 BetterWright 已选择外部 provider 且报告 ready 时，未使用的 BetterChromium 检查误阻断；通过结构化 provider 字段判断，保留其他失败和 CDP 网络代理警告。
- 明确确定性结果 actual 的 JSON 原始类型，要求布尔观察逐项核验，禁止复制 expected 或返回包装对象；不改变严格比较逻辑。
- 补充 provider 状态、警告保留、模型与运行时阻断，以及布尔结果不强制转换的回归测试。

## 0.3.2

- 工作区初始化生成包含完整字段说明的配置模板，并补充配置文档。
- 兼容 BetterWright 截图返回的 artifact 对象，将有效的 path 规范化为步骤和结果的 proof 路径。
- 明确截图证据的返回格式，并增加有效路径与无效证据的回归测试。

## 0.3.1

- 新增 `auto-e2e workspace init`，创建带安全默认值的 `.auto-e2e/config.yaml` 和 `.auto-e2e/specs/`。
- 项目配置统一为 `.auto-e2e/config.yaml`，兼容旧配置并支持全局 `--config` 参数。
- 新项目运行数据默认存入 `~/.auto-e2e/projects/<workspaceId>/`，支持 `AUTO_E2E_HOME` 和旧项目存储兼容。
- 同步 Web UI 配置保存、截图读取、Git 忽略规则、Skill 模板及迁移文档。
- Web UI 执行页支持勾选一个或多个用例按需运行，服务端校验选择范围后仅执行所选用例。

- 新增 GitHub Actions CI 与 tag 触发的 npm OIDC 自动发布，校验版本、lockfile 和 main 归属，并跳过已发布版本。
- npm 包名改为 `@jarome/auto-e2e`，避免与 npmjs 上已有的非关联包重名。
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
