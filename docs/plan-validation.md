# auto-e2e 第一版验证计划

## 1. 文档目标

本文档用于验证 `auto-e2e` 第一版是否达到可用、可集成、可重复执行的标准。

本次验证重点不是继续增加功能，而是确认以下闭环能够稳定工作：

```text
Codex 完成开发任务
    ↓
生成 task-spec.json
    ↓
auto-e2e 读取需求与 Git Diff
    ↓
生成测试计划
    ↓
BetterWright 探索页面
    ↓
生成 Playwright Test
    ↓
执行本次增量测试
    ↓
生成结构化结果与 HTML 报告
    ↓
Codex 根据结果修复或结束任务
```

---

## 2. 第一版验证范围

本次仅验证第一版范围，不包含以下能力：

- 多项目分布式执行；
- 自动修改业务代码；
- 无限自动修复；
- Web 管理后台；
- 测试历史趋势分析；
- 多浏览器兼容矩阵；
- 自动处理验证码；
- 自动生成和维护完整测试资产库。

第一版必须支持：

- 单个 Web 项目；
- Chromium；
- 一个登录 Profile；
- ChatGPT OAuth 登录；
- 增量任务验证；
- 全量 Playwright 测试执行；
- JSON、HTML 报告；
- Screenshot、Trace，必要时保留 Video；
- 非交互模式；
- 固定退出码；
- Codex 可读取结构化结果。

---

## 3. 验证环境

### 3.1 基础环境

建议准备以下环境：

```text
Node.js: 22 或更高版本
包管理器: npm / pnpm
Git: 已安装
BetterWright: 已安装并完成 setup
Playwright: 与项目配置匹配
Chromium: 可正常启动
操作系统: macOS 或 Linux
```

执行基础检查：

```bash
node -v
npm -v
git --version
betterwright doctor
auto-e2e --version
```

验收要求：

- 所有命令可执行；
- BetterWright 浏览器可启动；
- 不存在缺失依赖；
- 不要求用户手工修改全局环境变量才能执行。

### 3.2 ChatGPT 登录验证

执行：

```bash
auto-e2e auth login
```

验证内容：

- 能完成 ChatGPT OAuth 登录；
- 登录状态能够持久化；
- 重复执行时不要求每次重新登录；
- Token、Cookie、Session 不输出到控制台和报告；
- 登录失效时能够返回明确错误。

---

## 4. 测试项目准备

建议先建立一个最小演示项目，不要直接使用复杂业务项目。

### 4.1 演示项目功能

演示项目至少包含：

- 登录页；
- 用户列表；
- 新增用户；
- 禁用用户；
- 成功提示；
- 失败提示；
- 一个故意保留的业务 Bug。

建议故意保留以下 Bug：

> 用户被禁用后，仍然可以登录系统。

### 4.2 测试账号

准备两个固定账号：

```text
管理员账号：admin@example.com
普通账号：user@example.com
```

要求：

- 账号数据可以重复初始化；
- 测试不能依赖人工准备数据；
- 每次执行结果尽量一致；
- 测试账号不得使用生产环境账号。

### 4.3 推荐测试任务

在演示项目中实现“用户禁用”功能，并准备：

```json
{
  "taskId": "TASK-001",
  "title": "新增用户禁用功能",
  "requirement": "管理员可以禁用用户，禁用用户不能登录。",
  "acceptanceCriteria": [
    "用户列表显示禁用按钮",
    "点击禁用后出现确认框",
    "取消确认不会修改用户状态",
    "确认禁用后用户状态变为已禁用",
    "已禁用用户不能登录"
  ],
  "changedRoutes": [
    "/users",
    "/login"
  ],
  "changedApis": [
    "PUT /api/users/:id/disable",
    "POST /api/login"
  ],
  "baseUrl": "http://127.0.0.1:3000",
  "startCommand": "npm run dev"
}
```

文件路径：

```text
.auto-e2e/task-spec.json
```

---

## 5. 功能验证

## 5.1 初始化验证

执行：

```bash
auto-e2e init
```

预期结果：

- 创建 `.auto-e2e/` 目录；
- 创建默认配置文件；
- 创建报告目录；
- 不覆盖已有配置；
- 重复执行不会破坏原有内容；
- 输出下一步执行提示。

检查目录：

```text
.auto-e2e/
├── config.yaml
├── generated/
├── reports/
├── sessions/
└── artifacts/
```

## 5.2 配置加载验证

验证以下配置来源：

1. 默认配置；
2. `.auto-e2e/config.yaml`；
3. 命令行参数覆盖；
4. 环境变量覆盖；
5. 非法配置报错。

建议验证：

```bash
auto-e2e config show
auto-e2e verify --base-url http://127.0.0.1:3000
```

验收要求：

- 配置优先级明确；
- 非法字段有明确提示；
- 缺失必填项时不继续执行；
- 敏感配置不明文输出。

## 5.3 task-spec 校验

分别测试：

- 完整 task-spec；
- 缺少 `taskId`；
- 缺少 `acceptanceCriteria`；
- `acceptanceCriteria` 为空；
- `baseUrl` 非法；
- JSON 格式错误；
- 文件不存在。

执行：

```bash
auto-e2e verify --spec .auto-e2e/task-spec.json --non-interactive
```

验收要求：

- 完整 task-spec 可正常进入后续流程；
- 不合法输入必须立即失败；
- 返回固定退出码；
- 即使失败，也尽量生成结构化 `result.json`。

## 5.4 Git Diff 分析

准备以下变更：

- 前端页面变更；
- API 调用变更；
- 后端接口变更；
- 非业务文件变更；
- 无 Git Diff；
- 非 Git 仓库目录。

验证内容：

- 能读取 staged 和 unstaged diff；
- 能识别变更文件；
- 能把变更文件关联到页面和接口；
- 不应把 README 修改误判为业务风险；
- 无 Diff 时给出明确提示；
- 非 Git 仓库时返回明确错误。

## 5.5 测试计划生成

执行：

```bash
auto-e2e generate --spec .auto-e2e/task-spec.json
```

检查：

```text
.auto-e2e/generated/TASK-001/test-plan.json
```

`test-plan.json` 至少包含：

```json
{
  "taskId": "TASK-001",
  "tests": [],
  "coverage": {
    "acceptanceCriteria": [],
    "covered": [],
    "uncovered": []
  },
  "preconditions": [],
  "testData": [],
  "risks": []
}
```

验收要求：

- 每条验收标准都能映射到测试项；
- 未覆盖项必须明确列出；
- 不允许把没有执行依据的内容标记为已覆盖；
- 测试步骤具备可执行性；
- 测试数量不应无限膨胀。

## 5.6 BetterWright 页面探索

验证场景：

```text
访问 /login
完成管理员登录
进入 /users
定位用户列表
定位禁用按钮
打开确认框
取消操作
再次打开确认框并确认
记录页面状态变化
```

建议输出：

```text
.auto-e2e/generated/TASK-001/exploration.json
.auto-e2e/artifacts/TASK-001/exploration/
```

`exploration.json` 建议包含：

- 实际访问 URL；
- 页面标题；
- 识别到的关键元素；
- 候选 Locator；
- 最终 Locator；
- 页面状态变化；
- 关键网络请求；
- 截图路径；
- 探索失败原因。

验收要求：

- 能完成登录和页面访问；
- 不依赖固定等待时间；
- 页面找不到元素时有明确错误；
- 浏览器异常退出后能够正确清理；
- 浏览器 Session 可复用。

## 5.7 Playwright Test 生成

检查生成目录：

```text
.auto-e2e/generated/TASK-001/
├── test-plan.json
├── exploration.json
├── user-disable.spec.ts
└── generation-meta.json
```

重点检查生成测试是否存在以下问题：

- 使用动态 CSS class；
- 大量使用 `nth()`；
- 大量使用 `waitForTimeout()`；
- 缺少核心业务断言；
- 测试依赖执行顺序；
- 账号和密码直接硬编码；
- 使用随机且不可恢复的数据；
- 只验证点击成功，不验证业务结果；
- TypeScript 无法编译；
- Locator 与探索结果不一致。

验收要求：

- 优先使用 `getByRole`、`getByLabel`、`getByTestId`；
- 每个测试可以独立运行；
- 测试具备明确断言；
- 测试文件可以被 Playwright 正常加载；
- 生成元数据中记录模型、任务和输入摘要。

## 5.8 增量验证

执行：

```bash
auto-e2e verify \
  --spec .auto-e2e/task-spec.json \
  --non-interactive
```

预期流程：

```text
读取需求
→ 读取 Git Diff
→ 生成测试计划
→ BetterWright 探索
→ 生成测试
→ Playwright 执行
→ 分析失败
→ 生成报告
```

验收要求：

- 自动启动或连接目标应用；
- 完成增量用例执行；
- 正确发现预留 Bug；
- 将失败分类为 `product_defect`；
- 输出截图和 Trace；
- 生成 JSON 和 HTML 报告；
- 退出码为测试失败对应的固定值。

## 5.9 全量测试验证

执行：

```bash
auto-e2e run --all --non-interactive
```

验证内容：

- 能发现已有 Playwright 配置；
- 能执行项目全量测试；
- 能区分增量测试和历史测试；
- 能汇总通过、失败、跳过数量；
- 全量测试失败时仍生成报告；
- 不应重新生成全部测试。

## 5.10 报告验证

检查：

```text
.auto-e2e/reports/latest/result.json
.auto-e2e/reports/latest/report.html
```

`result.json` 至少包含：

```json
{
  "taskId": "TASK-001",
  "status": "failed",
  "summary": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "skipped": 0,
    "durationMs": 0
  },
  "coverage": {
    "acceptanceCriteria": 5,
    "covered": 5,
    "uncovered": []
  },
  "failures": [
    {
      "test": "已禁用用户不能登录",
      "category": "product_defect",
      "expected": "登录被拒绝",
      "actual": "成功进入首页",
      "confidence": 0.95,
      "artifacts": {
        "screenshot": "",
        "trace": "",
        "video": ""
      }
    }
  ]
}
```

失败分类至少支持：

```text
product_defect
test_defect
environment_failure
data_failure
auth_failure
flaky
unknown
```

验收要求：

- JSON 可以被程序稳定解析；
- HTML 报告可直接打开；
- 报告中的文件路径有效；
- 不包含 Token、Cookie、密码；
- 失败分类有依据；
- 未覆盖项必须真实反映。

---

## 6. 失败场景验证

以下场景必须逐项验证。

| 编号 | 失败场景 | 预期结果 |
|---|---|---|
| F01 | 应用启动失败 | 返回环境错误，生成 result.json |
| F02 | 健康检查超时 | 返回超时信息，清理启动进程 |
| F03 | ChatGPT OAuth 失效 | 返回 auth_failure，不泄露凭证 |
| F04 | BetterWright 浏览器未安装 | 提示执行 setup |
| F05 | 目标页面 404 | 分类为 environment_failure 或 product_defect |
| F06 | 登录失败 | 分类为 auth_failure |
| F07 | task-spec JSON 非法 | 配置校验失败，不启动浏览器 |
| F08 | AI 返回非法 JSON | 自动重试有限次数，随后明确失败 |
| F09 | 生成的 TypeScript 无法编译 | 分类为 test_defect |
| F10 | Playwright 超时 | 保留 Trace 和截图 |
| F11 | 报告目录无权限 | 明确提示并返回固定退出码 |
| F12 | 当前目录不是 Git 仓库 | 明确提示，不继续 Diff 分析 |
| F13 | 没有 Git Diff | 可按配置继续或明确终止 |
| F14 | 全量测试存在历史失败 | 标明历史失败与本次失败 |
| F15 | 浏览器进程意外退出 | 正确清理并生成失败报告 |
| F16 | 应用进程未退出 | auto-e2e 结束时完成清理 |

每个失败场景必须满足：

- 有清晰控制台提示；
- 有固定退出码；
- 尽量生成 `result.json`；
- 不遗留浏览器和应用进程；
- 不泄露敏感信息。

---

## 7. auto-e2e 自身测试

## 7.1 单元测试

至少覆盖：

- 配置加载；
- task-spec 校验；
- Git Diff 解析；
- 路径处理；
- 退出码映射；
- Playwright 结果解析；
- 报告序列化；
- 失败分类；
- 敏感信息脱敏；
- 子进程清理。

建议目标：

```text
核心模块单元测试覆盖率不低于 80%
```

## 7.2 集成测试

使用固定输入替代真实模型和浏览器：

```text
固定 task-spec
固定 Git Diff
固定 exploration 结果
固定模型返回
固定 Playwright 结果
```

验证：

```text
task-spec
→ test-plan
→ spec.ts
→ result.json
```

集成测试不得依赖真实 ChatGPT 登录。

## 7.3 冒烟测试

至少执行：

```bash
auto-e2e init
auto-e2e generate --spec examples/task-spec.json
auto-e2e verify --spec examples/task-spec.json --non-interactive
auto-e2e run --all --non-interactive
```

---

## 8. Codex 集成验证

在测试项目中增加 `AGENTS.md` 或项目 Skill，要求 Codex 完成任务后执行：

```text
1. 完成代码修改。
2. 运行单元测试和静态检查。
3. 根据原始需求和 Git Diff 生成 .auto-e2e/task-spec.json。
4. 执行 auto-e2e verify --spec .auto-e2e/task-spec.json --non-interactive。
5. 读取 .auto-e2e/reports/latest/result.json。
6. product_defect：修改业务代码后重新执行。
7. test_defect：修复测试生成或测试脚本，不修改业务代码迎合测试。
8. 最多自动修复两轮。
9. 输出修改内容、测试范围、结果、未覆盖项和报告路径。
```

### Codex 集成验收场景

#### 场景 A：测试全部通过

预期：

- Codex 完成开发；
- 自动生成 task-spec；
- auto-e2e 执行通过；
- Codex 返回测试范围和报告路径；
- 不重复修改已正确的代码。

#### 场景 B：存在产品缺陷

预期：

- auto-e2e 分类为 `product_defect`；
- Codex 修复业务代码；
- 再次执行 auto-e2e；
- 最多重试两轮；
- 最终明确说明是否通过。

#### 场景 C：生成测试错误

预期：

- auto-e2e 分类为 `test_defect`；
- Codex 不修改业务代码；
- 修复测试脚本或重新生成；
- 重新执行验证。

---

## 9. 稳定性验证

同一个任务连续执行 10 次：

```bash
for i in {1..10}; do
  auto-e2e verify \
    --spec .auto-e2e/task-spec.json \
    --non-interactive || true
done
```

记录：

- 每次总耗时；
- 模型调用次数；
- 生成测试数量；
- 测试结果；
- Locator 变化；
- 是否崩溃；
- 是否遗留进程；
- 是否出现误判。

验收要求：

- 不发生随机崩溃；
- 同一 Bug 的分类基本稳定；
- 生成测试数量不会大幅波动；
- 不出现大量 Locator 随机变化；
- 不遗留浏览器和应用进程；
- 报告目录结构保持一致。

---

## 10. 真实项目试点

演示项目通过后，选择一个真实项目中的小需求。

### 10.1 试点需求选择标准

优先选择：

- 单页面或两到三个页面；
- 3～5 条验收标准；
- 有稳定测试账号；
- 不涉及验证码；
- 不涉及支付；
- 不依赖多个外部系统；
- 前后端可以本地启动。

### 10.2 试点记录指标

记录：

```text
需求规模
Git 变更文件数
探索耗时
模型调用次数
生成测试数
首次执行通过率
Locator 失败次数
产品缺陷识别数
测试缺陷误判数
人工修改测试次数
总执行时间
```

### 10.3 试点结论

试点结束后输出：

- 能否直接用于日常开发；
- 哪些步骤仍需人工介入；
- 最大的不稳定来源；
- 第二版最优先解决的问题；
- 是否达到发布条件。

---

## 11. 建议退出码

| 退出码 | 含义 |
|---|---|
| 0 | 测试通过 |
| 1 | 测试失败 |
| 2 | 应用或环境启动失败 |
| 3 | 测试生成失败 |
| 4 | 需求或 task-spec 不完整 |
| 5 | 登录或认证失败 |
| 6 | 浏览器执行失败 |
| 7 | 配置错误 |
| 8 | 报告生成失败 |
| 9 | 内部未知错误 |

验收要求：

- 同类错误始终返回相同退出码；
- Codex 和 CI 可以只依赖退出码和 `result.json`；
- 不使用模糊的全部返回 `1`。

---

## 12. 发布门槛

满足以下条件后，才建议发布 `0.1.0`：

```text
[ ] auto-e2e init 可重复执行
[ ] ChatGPT OAuth 登录和持久化正常
[ ] task-spec 校验完整
[ ] Git Diff 分析可用
[ ] 能生成 test-plan.json
[ ] BetterWright 能稳定完成页面探索
[ ] 能生成可编译的 Playwright Test
[ ] 能执行增量测试
[ ] 能执行全量测试
[ ] 能正确发现预留业务 Bug
[ ] 能区分 product_defect 和 test_defect
[ ] 能输出 result.json 和 HTML 报告
[ ] Screenshot 和 Trace 路径有效
[ ] 所有主要失败都有固定退出码
[ ] 敏感信息不会写入日志和报告
[ ] 非交互模式可被 Codex 调用
[ ] 同一任务连续执行 10 次无随机崩溃
[ ] 无遗留应用进程和浏览器进程
[ ] README 可让新用户完成首次执行
```

---

## 13. 验证执行顺序

建议严格按照以下顺序执行：

```text
阶段 1：基础环境和 OAuth
阶段 2：CLI 初始化和配置
阶段 3：task-spec 和 Git Diff
阶段 4：测试计划生成
阶段 5：BetterWright 页面探索
阶段 6：Playwright Test 生成
阶段 7：增量测试闭环
阶段 8：全量测试
阶段 9：失败场景
阶段 10：Codex 集成
阶段 11：连续稳定性测试
阶段 12：真实项目试点
阶段 13：0.1.0 发布评审
```

任何阶段未通过，不建议直接跳到真实项目试点。

---

## 14. 验证结果记录模板

```markdown
# auto-e2e 验证记录

## 基本信息

- auto-e2e 版本：
- Git Commit：
- 操作系统：
- Node.js 版本：
- BetterWright 版本：
- Playwright 版本：
- 验证日期：
- 验证人：

## 总体结果

- 通过：
- 失败：
- 阻塞：
- 是否达到发布标准：是 / 否

## 失败项

| 编号 | 功能 | 现象 | 原因 | 严重程度 | 是否阻塞发布 |
|---|---|---|---|---|---|
| | | | | | |

## 稳定性结果

- 连续执行次数：
- 成功次数：
- 失败次数：
- 随机崩溃次数：
- 误判次数：
- 平均执行时间：

## 真实项目试点

- 项目名称：
- 需求名称：
- 验收标准数量：
- 生成测试数量：
- 发现产品缺陷数量：
- 发现测试缺陷数量：
- 人工修改测试次数：

## 最终结论

- 发布决定：
- 阻塞问题：
- 第二版优先事项：
```

---

## 15. 第一轮验证的最低目标

第一轮验证至少必须完成以下闭环：

```text
创建演示项目
→ 保留一个“禁用用户仍可登录”的 Bug
→ Codex 完成用户禁用功能
→ Codex 生成 task-spec.json
→ auto-e2e 生成测试计划
→ BetterWright 探索页面
→ auto-e2e 生成 Playwright Test
→ 执行测试并发现 Bug
→ 分类为 product_defect
→ 输出 result.json、HTML、Screenshot、Trace
→ Codex 读取结果并修复
→ 再次执行并通过
```

只有这条闭环成功，才能认为 `auto-e2e` 第一版真正完成。
