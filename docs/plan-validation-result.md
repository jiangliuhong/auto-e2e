# auto-e2e 验证记录

> 基于 `plan-validation.md` 对 `auto-e2e` 第一版进行实际执行验证。
> 验证方式：在隔离目录 `/tmp/ae2e-validate/demo` 中执行 CLI，结合源码审查与单元测试。

## 基本信息

- auto-e2e 版本：0.1.0
- Git Commit：`new` 分支（`9d20b2c flush`）
- 操作系统：macOS 24.3.0 arm64
- Node.js 版本：v24.10.0
- Playwright 版本：1.62.0（npx 拉取，项目未固定）
- BetterWright 版本：未安装（验证以 `implementation: mock` 离线模式进行）
- 验证日期：2026-07-29
- 验证人：ZCode

## 总体结果

- 通过：阶段 1、2、3、5 的核心行为；退出码；安全/敏感信息；CLI 命令面
- 失败/阻塞：阶段 4（Git Diff 未接入主流程）、阶段 7（Playwright 无法执行测试）、阶段 8（无真实闭环）
- 是否达到发布标准：**否**

核心结论：**当前的 Playwright 执行链路存在阻断性缺陷（`--screenshot`/`--video` 非合法 CLI 选项，导致 0 用例被执行却报“通过”），Git Diff 分析模块未接入 verify/generate 主流程。因此第一版“端到端闭环”不可用，达不到 §12 发布门槛，不建议发布 0.1.0。**

---

## 分阶段验证明细

### 阶段 1：基础环境 ✅

| 项 | 结果 |
|---|---|
| `node -v` / `npm -v` / `git --version` | ✅ 全部可用 |
| `npm run build`（tsc） | ✅ 通过 |
| `npm run typecheck` | ✅ 通过（exit 0） |
| `npm test`（vitest） | ✅ 12 文件 / 51 用例全部通过 |
| `auto-e2e --version` / `--help` | ✅ 0.1.0，命令列表完整 |

> 说明：`betterwright doctor` 与真实 OAuth 登录因可选依赖未安装，以 mock 模式验证，符合集成测试“不得依赖真实 ChatGPT 登录”的要求。

### 阶段 2：初始化与配置（§5.1 / §5.2）⚠️

| 验收点 | 结果 |
|---|---|
| `init` 创建 `.auto-e2e/{config.yaml,task-spec.json,generated,reports,artifacts,auth}` | ✅ |
| 重复执行不覆盖已有配置（需 `--force`） | ✅ 已验证 |
| 配置优先级：默认 → config.yaml → 环境变量（`AUTO_E2E_*`） | ✅ 代码确认（config-loader.ts） |
| 非法配置 → 明确 zod 错误 + 退出码 7 | ✅ 已验证（exit 7） |
| **`auto-e2e config show`** | ❌ **命令不存在**（`error: unknown command 'config'`） |

**问题 V-2.1（中等）**：`plan-validation.md §5.2` 明确要求 `auto-e2e config show`，但未实现。

**问题 V-2.2（轻微）**：`init` 生成的目录为 `auth/`，而 §5.1 期望模板含 `sessions/`。属命名差异，不阻塞。

### 阶段 3：task-spec 校验（§5.3）✅

| 场景 | 预期退出码 | 实测 |
|---|---|---|
| 完整 task-spec | 进入后续流程 | ✅ 进入应用启动阶段 |
| 缺 taskId | 4 | ✅ exit 4，`taskId: Required` |
| 缺 acceptanceCriteria | 4 | ✅ exit 4 |
| acceptanceCriteria 为空 | 4 | ✅ exit 4，明确提示 |
| baseUrl 非法 | 4 | ✅ exit 4，`baseUrl: Invalid url` |
| JSON 格式错误 | 4 | ✅ exit 4，带解析位置 |
| 文件不存在 | 4 | ✅ exit 4，ENOENT 提示 |

task-spec 校验完全符合验收要求，所有非法输入立即失败并返回固定退出码。

### 阶段 4：Git Diff 分析（§5.4）❌ 阻塞

**问题 V-4.1（阻塞）**：`git-diff-reader.ts` 与 `change-analyzer.ts` 作为独立模块存在（且有单元测试：合并 tracked/untracked、去重、按路由/API/组件归类、README 不误判），但 **未接入 `verify` / `generate` 主流程**：

- `src/commands/verify.ts` 中 `opts.changed` 选项被声明但**从未读取**；流程始终读取 `task-spec.json`，从不调用 `readChangedFiles` / `isGitRepo`。
- `src/commands/generate.ts` 同样不调用 Git 模块。
- 实测：在非 Git 目录执行 `verify --changed` 不会报告“非 Git 仓库”，而是继续找 task-spec → exit 4（task-spec 不存在）。

直接影响：
- §6.5 `verify --changed`（基于 Git Diff 执行）**未实现**。
- §5.4 验收点“无 Diff 时给出明确提示 / 非 Git 仓库返回明确错误”**不满足**。
- F12（非 Git 仓库）、F13（无 Git Diff）失败场景**未实现**。

### 阶段 5：测试计划生成（§5.5）✅（结构）⚠️（字段）

`generate` 命令在 mock 模式下成功生成 `.auto-e2e/generated/{taskId}/`：

```
test-plan.json ✅
exploration.json ✅
generation-meta.json ✅
{taskId}.spec.ts ✅
```

- ✅ 每条验收标准映射到一个测试用例（5 条 AC → TC-001~TC-005 + 1 个反向用例），`uncoveredCriteria: []`。
- ✅ test-plan.json 结构符合 `plan.md §9`（testCases / uncoveredCriteria / risks）。

**问题 V-5.1（轻微）**：`plan-validation.md §5.5` 的“至少包含”模板期望顶层字段 `coverage{acceptanceCriteria,covered,uncovered}`、`preconditions`、`testData`、`risks`；实际 test-plan.json 仅有 `uncoveredCriteria`/`risks`，`preconditions` 嵌在用例内，缺 `coverage` 与 `testData`。与 `plan.md §9` 的规范一致，但与 validation 模板不符。

### 阶段 6：BetterWright 探索与测试生成（§5.6 / §5.7）⚠️

**探索（§5.6）**：
- ✅ explorer 定位器优先级正确实现（getByTestId → getByRole → getByLabel → getByPlaceholder → getByText），**禁止长 CSS 路径**（chooseLocator 显式不回退到 CSS）。
- ✅ mock 模式可完成探索闭环。
- ⚠️ 真实 BetterWright 探索未验证（依赖未安装）。

**测试生成（§5.7）**：生成文件可通过 `tsc --noEmit` 编译（✅ 无语法/类型错误）。

**问题 V-6.1（阻塞，针对生成质量）**：生成的 `{taskId}.spec.ts` 每个测试**只有注释 `// 预期：...`，没有任何 `expect(...)` 断言**，也未使用探索得到的定位器（无 `getByTestId`/`getByRole`）。直接违反 §5.7 验收“测试具备明确断言”、`plan.md §11.2`“使用真实断言”、§5.7 反例清单“缺少核心业务断言 / Locator 与探索结果不一致”。

> 说明：这是 mock Pi client 的产物。真实 SDK 模式下质量取决于模型，但当前无法证明生成器会产出带断言的可用测试，闭环不可信。

### 阶段 7：增量执行与报告（§5.8 / §5.9 / §5.10）❌ 阻塞

在健康检查服务可达（mock）下运行 `verify` 全流程：

**问题 V-7.1（阻断性）**：Playwright 实际执行失败，`npx playwright test` 报：
```
error: unknown option '--screenshot'
```
根因（`src/playwright/reporter-config.ts:57-58`）：`buildPlaywrightArgs` 把 `--screenshot`、`--video` 作为 `playwright test` 的 CLI 选项传入，但 **`playwright test` 只接受 `--trace`，不接受 `--screenshot` / `--video`**（这两个属配置文件选项）。`run --all` 同样失败。

**问题 V-7.2（阻断性）**：Playwright 因 V-7.1 立即退出，**0 个用例被执行**，但 auto-e2e 仍输出 `✅ 通过 | 用例 0` 并返回退出码 0。`result.json` 也记为 `"status":"passed","total":0`，`coverage.covered:5`。这是**严重误判**：没有运行任何测试却被判定为通过，Codex/CI 据此会认为功能正确。

**问题 V-7.3（中等）**：§5.10 要求 `report.html` 可直接打开。实际只产出 `result.json` + `summary.md`；`summary.md` 里引用的 `html/index.html` 因 Playwright 失败并不存在。auto-e2e 自身未生成独立 HTML 报告。

result.json 字段结构本身符合 §13.1（taskId/status/summary/coverage/failures）；失败分类枚举完整（含 `browser_failure`，覆盖 §5.10 全部类别）——但这些在测试无法执行的前提下无法真正验证。

### 失败场景（§6 F01–F16）

已验证：F01（应用启动失败 → exit 2 ✅）、F07（task-spec 非法 → exit 4 ✅）、F11（报告目录可写 ✅）。

未实现/未验证（受 V-4.1 / V-7.1 阻塞）：
- F02 健康检查超时清理 ✅（单元测试覆盖 process-manager）
- F03 OAuth 失效不泄露凭证 ✅（非交互模式 exit 5，token 不入日志）
- F04 BetterWright 未安装提示 ⚠️ 未验证
- F05/F06 需真实浏览器 ⚠️ 未验证
- F08 AI 返回非法 JSON 重试 ⚠️ 仅 mock
- F09 TypeScript 无法编译分类为 test_defect ❌ 因无断言、未真实执行，无法验证
- F10 Playwright 超时保留 Trace ❌ 因 V-7.1 根本无法启动执行
- F12 非 Git 仓库 ❌（V-4.1）
- F13 无 Git Diff ❌（V-4.1）
- F14/F15/F16 ⚠️ 未验证

### 阶段 8–12：Codex 集成 / 稳定性 / 真实试点

- 阻塞，未执行。前置阶段（4、7）未通过，按 §13“任何阶段未通过，不建议直接跳到真实项目试点”。
- Codex 集成示例文件 `examples/AGENTS.md` 已提供（内容完整），但因闭环不可用，无法完成场景 A/B/C。

---

## 失败项汇总

| 编号 | 功能 | 现象 | 原因 | 严重程度 | 阻塞发布 |
|---|---|---|---|---|---|
| V-7.1 | Playwright 执行 | `error: unknown option '--screenshot'`，0 用例执行 | reporter-config 误把 `--screenshot`/`--video` 当 CLI 选项 | 阻断 | 是 |
| V-7.2 | 结果判定 | 0 用例却报“通过”、exit 0 | 未校验“实际执行了用例” | 阻断 | 是 |
| V-4.1 | Git Diff 接入 | `verify --changed` 无效，非 Git 目录无提示 | verify/generate 未调用 git 模块 | 阻断 | 是 |
| V-6.1 | 测试生成质量 | 生成测试无 `expect` 断言、不用定位器 | mock 生成器只写注释 | 阻断 | 是 |
| V-7.3 | HTML 报告 | `report.html` 不存在 | 依赖 Playwright HTML，自身未生成 | 中等 | 是 |
| V-2.1 | config show | 命令缺失 | 未实现 | 中等 | 否 |
| V-5.1 | test-plan 字段 | 缺 coverage/testData 顶层字段 | 与 validation 模板不符 | 轻微 | 否 |

## §12 发布门槛对照

```
[x] auto-e2e init 可重复执行
[ ] ChatGPT OAuth 登录和持久化正常        (mock 验证，真实未验证)
[x] task-spec 校验完整
[ ] Git Diff 分析可用                      (V-4.1 未接入)
[x] 能生成 test-plan.json                  (结构正确)
[~] BetterWright 能稳定完成页面探索         (mock 可用，真实未验证)
[~] 能生成可编译的 Playwright Test          (可编译，但无断言 V-6.1)
[ ] 能执行增量测试                          (V-7.1 无法执行)
[ ] 能执行全量测试                          (V-7.1 无法执行)
[ ] 能正确发现预留业务 Bug                  (无法执行)
[ ] 能区分 product_defect 和 test_defect    (无法执行)
[~] 能输出 result.json 和 HTML 报告         (JSON ✅，HTML ❌)
[ ] Screenshot 和 Trace 路径有效            (无法执行)
[x] 所有主要失败都有固定退出码
[x] 敏感信息不会写入日志和报告
[x] 非交互模式可被 Codex 调用
[ ] 同一任务连续执行 10 次无随机崩溃        (闭环不可用)
[ ] 无遗留应用进程和浏览器进程              (部分：app.stop 已实现，浏览器未验证)
[x] README 可让新用户完成首次执行
```

## 最终结论

- **发布决定：不建议发布 0.1.0。** 第一版核心闭环（生成测试 → 执行 → 发现 Bug）在当前代码下完全不可用：Playwright 因非法 CLI 选项无法执行任何用例，且系统将“0 用例”误判为通过。
- **阻塞问题**：V-7.1（Playwright CLI 选项）、V-7.2（0 用例误判通过）、V-4.1（Git Diff 未接入）、V-6.1（生成测试无断言）、V-7.3（无 HTML 报告）。
- **第二版优先事项（修复顺序）**：
  1. 修复 `buildPlaywrightArgs`：移除 `--screenshot`/`--video`，改为写入临时 `playwright.config.ts` 片段或用 `--config`。
  2. `runPlaywright` 后校验“用例总数 > 0”，否则视为异常退出码（8），禁止报“通过”。
  3. 把 `readChangedFiles`/`isGitRepo` 接入 `verify`/`generate`，实现 `--changed` 与 F12/F13。
  4. 生成器必须输出真实 `expect` 断言并使用探索定位器（即使 mock 模式也应产出可执行断言）。
  5. auto-e2e 自身生成独立 HTML 报告（或保证 Playwright HTML 必然产出）。
  6. 补 `config show` 子命令。

> 上述 6 项修复后，需重跑本验证计划阶段 4/6/7，并在真实 BetterWright + ChatGPT OAuth 下完成 §15 最低目标闭环，方可进入发布评审。
