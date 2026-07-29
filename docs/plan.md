# auto-e2e 第一版开发计划

## 1. 项目目标

开发一个名为 `auto-e2e` 的本地 CLI 工具。

该工具基于 Pi 实现，并使用 ChatGPT OAuth 登录能力完成测试分析与测试脚本生成。它的主要职责是：

1. 接收 Codex 完成开发任务后整理出的需求与变更信息。
2. 分析本次需求、代码变更、影响页面和风险点。
3. 使用 BetterWright 探索真实页面、识别稳定定位方式和关键交互路径。
4. 生成本次任务对应的 Playwright E2E 测试脚本。
5. 执行本次增量测试，或者执行项目全量 E2E 测试。
6. 输出控制台、JSON、HTML 和 JUnit 格式的测试报告。
7. 为 Codex 提供稳定的机器调用方式、退出码和结果文件。

第一版只完成一条稳定闭环：

```text
Codex 完成开发
    ↓
生成 task-spec.json
    ↓
auto-e2e 分析需求和代码变更
    ↓
BetterWright 探索页面
    ↓
生成 Playwright Test
    ↓
执行测试
    ↓
输出 result.json 和 HTML 报告
```

---

## 2. 第一版范围

### 2.1 必须支持

第一版必须支持以下能力：

- 单个 Web 项目。
- Chromium 浏览器。
- 一个登录 Profile，例如 `admin`。
- ChatGPT OAuth 登录。
- 根据 `task-spec.json` 生成本次任务测试。
- 根据 Git Diff 补充分析实际代码变更。
- 使用 BetterWright 探索目标页面。
- 生成 `@playwright/test` 测试脚本。
- 执行本次增量测试。
- 执行项目全量 Playwright 测试。
- 输出 Console、JSON、HTML 和 JUnit 报告。
- 测试失败时保留截图、Trace 和视频。
- 支持非交互模式。
- 支持固定次数重试。
- 提供明确退出码。

### 2.2 第一版不做

第一版不要实现以下能力：

- 自动修改业务代码。
- 自动提交 Git。
- 无限自动修复循环。
- 多项目并行执行。
- 分布式测试。
- 自建 WebUI。
- 多浏览器矩阵。
- 测试历史趋势平台。
- 自动处理验证码。
- 自动维护复杂测试数据平台。
- 自动将生成用例永久合并到主测试目录。

---

## 3. 技术选型

### 3.1 推荐技术栈

- Node.js 22 或更高版本。
- TypeScript。
- Pi Agent Runtime。
- BetterWright。
- `@playwright/test`。
- Commander.js 或 Pi 自带命令扩展能力。
- Zod，用于配置和输入校验。
- YAML，用于项目配置。
- SQLite 暂不使用，第一版只使用文件系统。
- Vitest，用于 `auto-e2e` 自身单元测试。

### 3.2 组件职责

#### Pi

负责：

- ChatGPT OAuth 登录。
- 需求理解。
- 测试计划生成。
- BetterWright 探索任务编排。
- Playwright 测试代码生成。
- 失败分析。
- 报告摘要生成。

#### BetterWright

负责：

- 打开和操作真实浏览器。
- 登录和复用浏览器会话。
- 页面结构探索。
- 收集稳定定位器。
- 观察页面状态变化。
- 记录网络请求。
- 截图和页面证据收集。

#### Playwright Test

负责：

- 测试执行。
- 断言。
- Fixture。
- 重试。
- 超时。
- Trace。
- 视频。
- 截图。
- HTML Reporter。
- JUnit Reporter。

---

## 4. 整体架构

```text
┌──────────────────────────────────────────┐
│ Codex                                    │
│                                          │
│ 1. 完成开发                              │
│ 2. 整理需求和变更                        │
│ 3. 生成 task-spec.json                   │
│ 4. 调用 auto-e2e                         │
└───────────────────┬──────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│ auto-e2e CLI                             │
│                                          │
│ Requirement Analyzer                     │
│ Change Analyzer                          │
│ Test Planner                             │
│ BetterWright Explorer                    │
│ Test Generator                           │
│ Playwright Runner                        │
│ Failure Analyzer                         │
│ Report Generator                         │
└───────────────┬──────────────────────────┘
                │
       ┌────────┴─────────┐
       ▼                  ▼
 BetterWright       @playwright/test
 页面探索           正式测试执行
       │                  │
       └────────┬─────────┘
                ▼
      JSON / HTML / JUnit / Artifacts
```

---

## 5. 项目目录结构

建议目录结构：

```text
auto-e2e/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── cli.ts
│   ├── index.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── generate.ts
│   │   ├── verify.ts
│   │   ├── run.ts
│   │   ├── analyze.ts
│   │   ├── report.ts
│   │   └── auth.ts
│   ├── config/
│   │   ├── config-loader.ts
│   │   ├── config-schema.ts
│   │   └── defaults.ts
│   ├── domain/
│   │   ├── task-spec.ts
│   │   ├── test-plan.ts
│   │   ├── explore-result.ts
│   │   ├── test-result.ts
│   │   └── failure-category.ts
│   ├── agent/
│   │   ├── pi-client.ts
│   │   ├── prompts/
│   │   │   ├── analyze-requirement.md
│   │   │   ├── create-test-plan.md
│   │   │   ├── explore-page.md
│   │   │   ├── generate-test.md
│   │   │   └── analyze-failure.md
│   │   └── schemas/
│   ├── betterwright/
│   │   ├── betterwright-client.ts
│   │   ├── explorer.ts
│   │   ├── session-manager.ts
│   │   └── evidence-collector.ts
│   ├── playwright/
│   │   ├── test-generator.ts
│   │   ├── runner.ts
│   │   ├── reporter-config.ts
│   │   └── result-parser.ts
│   ├── git/
│   │   ├── git-diff-reader.ts
│   │   └── change-analyzer.ts
│   ├── project/
│   │   ├── project-inspector.ts
│   │   ├── process-manager.ts
│   │   └── health-checker.ts
│   ├── report/
│   │   ├── report-generator.ts
│   │   ├── json-reporter.ts
│   │   ├── console-reporter.ts
│   │   └── junit-reporter.ts
│   ├── runtime/
│   │   ├── execution-context.ts
│   │   ├── exit-codes.ts
│   │   └── logger.ts
│   └── utils/
├── tests/
│   ├── unit/
│   └── fixtures/
└── examples/
    ├── task-spec.json
    └── config.yaml
```

项目接入 `auto-e2e` 后，在目标项目中生成：

```text
目标项目/
├── .auto-e2e/
│   ├── config.yaml
│   ├── task-spec.json
│   ├── auth/
│   │   └── admin/
│   ├── generated/
│   │   └── TASK-001/
│   │       ├── test-plan.json
│   │       ├── exploration.json
│   │       ├── generation-meta.json
│   │       └── task.spec.ts
│   ├── reports/
│   │   ├── latest/
│   │   │   ├── result.json
│   │   │   ├── junit.xml
│   │   │   ├── summary.md
│   │   │   └── html/
│   │   └── history/
│   └── artifacts/
│       └── TASK-001/
├── e2e/
├── playwright.config.ts
└── package.json
```

---

## 6. CLI 命令设计

### 6.1 初始化

```bash
auto-e2e init
```

职责：

- 检查当前目录是否为 Node.js Web 项目。
- 检查是否安装 Playwright。
- 创建 `.auto-e2e/config.yaml`。
- 创建 `.auto-e2e/generated`、`.auto-e2e/reports`、`.auto-e2e/artifacts`。
- 创建示例 `task-spec.json`。
- 检查 BetterWright 是否可用。
- 检查 Pi 登录状态。

### 6.2 登录

```bash
auto-e2e auth login
```

职责：

- 触发 ChatGPT OAuth 登录。
- 保存 Pi 所需认证信息。

浏览器业务账户登录：

```bash
auto-e2e auth browser --profile admin
```

职责：

- 使用 BetterWright 打开浏览器。
- 用户手动完成业务系统登录。
- 保存 Browser Session/Profile。

### 6.3 生成测试

```bash
auto-e2e generate --spec .auto-e2e/task-spec.json
```

职责：

- 读取任务描述。
- 读取 Git Diff。
- 生成测试计划。
- 使用 BetterWright 探索页面。
- 生成 Playwright Test。
- 不执行测试。

### 6.4 生成并执行本次任务

```bash
auto-e2e verify --spec .auto-e2e/task-spec.json
```

非交互模式：

```bash
auto-e2e verify \
  --spec .auto-e2e/task-spec.json \
  --non-interactive \
  --json
```

职责：

- 完整执行本次任务闭环。
- 最终通过退出码和 `result.json` 返回结果。

### 6.5 按 Git 变更执行

```bash
auto-e2e verify --changed
```

职责：

- 自动读取 Git Diff。
- 如果存在 `task-spec.json`，优先使用。
- 如果不存在，基于 Git Diff 和最近提交生成基础测试计划。
- 第一版仍建议 Codex必须生成 `task-spec.json`。

### 6.6 全量执行

```bash
auto-e2e run --all
```

职责：

- 执行项目 Playwright 配置下全部测试。
- 不重新生成全部测试。
- 输出全量测试报告。

### 6.7 执行指定测试集

```bash
auto-e2e run --suite smoke
auto-e2e run --tag user
```

第一版只需要实现 `--all`，`--suite` 和 `--tag` 可以作为预留参数。

### 6.8 分析最近失败

```bash
auto-e2e analyze --last
```

职责：

- 读取最近一次 Playwright JSON 结果。
- 读取截图、Trace 摘要和错误堆栈。
- 使用 Pi 分类失败原因。
- 输出失败分析。

### 6.9 打开报告

```bash
auto-e2e report open
```

职责：

- 打开 `.auto-e2e/reports/latest/html/index.html`。

---

## 7. 配置文件

目标项目配置文件：

```yaml
project:
  name: demo-web
  baseUrl: http://127.0.0.1:3000
  startCommand: npm run dev
  healthUrl: http://127.0.0.1:3000
  startupTimeout: 120000

agent:
  provider: chatgpt-oauth
  model: default
  thinkingLevel: high

browser:
  explorer: betterwright
  browser: chromium
  headless: true
  sessionProfile: admin
  timeout: 30000

playwright:
  configFile: playwright.config.ts
  generatedDirectory: .auto-e2e/generated
  retries: 1
  workers: 1
  trace: retain-on-failure
  screenshot: only-on-failure
  video: retain-on-failure

generation:
  requireAcceptanceCriteria: true
  preferTestId: true
  allowSourceModification: false
  maxTestsPerTask: 10
  overwriteGeneratedTests: true

report:
  outputDirectory: .auto-e2e/reports
  artifactDirectory: .auto-e2e/artifacts
  formats:
    - console
    - json
    - html
    - junit
```

配置要求：

- 使用 Zod 校验。
- 所有相对路径基于目标项目根目录解析。
- 环境变量可以覆盖配置。
- 密码、Token、Cookie 不允许写入普通配置文件。

---

## 8. task-spec.json 规范

Codex 完成开发后必须生成：

```json
{
  "taskId": "TASK-20260729-001",
  "title": "新增用户禁用功能",
  "requirement": "管理员可以在用户列表禁用用户，禁用后用户不能登录。",
  "acceptanceCriteria": [
    "用户列表展示禁用按钮",
    "点击禁用后需要二次确认",
    "禁用成功后状态显示为已禁用",
    "已禁用用户不能登录",
    "取消确认时不得修改用户状态"
  ],
  "changedFiles": [
    "src/pages/users/index.tsx",
    "src/api/users.ts",
    "server/controllers/user.ts"
  ],
  "changedRoutes": [
    "/users",
    "/login"
  ],
  "changedApis": [
    "PUT /api/users/:id/disable"
  ],
  "riskHints": [
    "用户状态缓存可能未刷新",
    "禁用接口可能缺少权限校验"
  ],
  "startCommand": "npm run dev",
  "baseUrl": "http://127.0.0.1:3000"
}
```

### 8.1 校验规则

必须字段：

- `taskId`
- `title`
- `requirement`
- `acceptanceCriteria`
- `changedFiles`

可选字段：

- `changedRoutes`
- `changedApis`
- `riskHints`
- `startCommand`
- `baseUrl`

当 `acceptanceCriteria` 为空时，`verify` 必须返回退出码 `4`。

---

## 9. test-plan.json 规范

Pi 根据任务信息生成：

```json
{
  "taskId": "TASK-20260729-001",
  "scope": "incremental",
  "testCases": [
    {
      "id": "TC-001",
      "title": "管理员成功禁用正常用户",
      "priority": "P0",
      "type": "positive",
      "acceptanceCriteria": [
        "点击禁用后需要二次确认",
        "禁用成功后状态显示为已禁用"
      ],
      "preconditions": [
        "管理员已登录",
        "目标用户状态为正常"
      ],
      "steps": [
        "打开用户列表",
        "找到目标用户",
        "点击禁用",
        "确认禁用"
      ],
      "expected": [
        "显示确认弹窗",
        "用户状态更新为已禁用"
      ]
    }
  ],
  "uncoveredCriteria": [],
  "risks": []
}
```

生成要求：

- 每条验收标准必须至少被一个测试用例覆盖。
- P0 用例优先生成。
- 默认最多生成 10 个测试。
- 必须包含正向流程。
- 有明确风险时生成至少一个反向用例。
- 不允许生成与本次需求无关的大量回归用例。

---

## 10. BetterWright 探索协议

### 10.1 探索输入

```ts
interface ExploreRequest {
  taskId: string;
  baseUrl: string;
  routes: string[];
  acceptanceCriteria: string[];
  testCases: TestCase[];
  sessionProfile?: string;
}
```

### 10.2 探索输出

```ts
interface ExploreResult {
  taskId: string;
  pages: Array<{
    route: string;
    title?: string;
    reachable: boolean;
    elements: Array<{
      description: string;
      recommendedLocator: string;
      fallbackLocators: string[];
      stable: boolean;
    }>;
    observedRequests: Array<{
      method: string;
      url: string;
      status?: number;
    }>;
    screenshots: string[];
  }>;
  blockers: string[];
}
```

### 10.3 探索要求

BetterWright 必须尽量收集：

- 页面 URL。
- 页面标题。
- 关键按钮。
- 表单字段。
- 对话框。
- 表格和列表。
- 可稳定使用的 `data-testid`。
- ARIA Role 和可见文本。
- 关键接口请求。
- 页面状态变化。
- 截图证据。

定位器优先级：

```text
getByTestId
→ getByRole
→ getByLabel
→ getByPlaceholder
→ getByText
→ CSS
→ XPath
```

第一版生成器禁止默认使用脆弱的长 CSS 路径。

---

## 11. Playwright Test 生成规则

### 11.1 生成位置

```text
.auto-e2e/generated/{taskId}/{taskId}.spec.ts
```

### 11.2 代码要求

生成的测试必须：

- 使用 TypeScript。
- 使用 `@playwright/test`。
- 使用 `test.describe`。
- 使用明确测试标题。
- 使用真实断言。
- 避免固定 `sleep`。
- 优先使用 Playwright 自动等待。
- 不修改业务代码。
- 不写死敏感密码。
- 不在代码中保存 Cookie 或 Token。
- 在需要时复用 `storageState`。
- 失败时能够生成 Trace 和截图。

示例：

```ts
import { expect, test } from '@playwright/test';

test.describe('TASK-20260729-001 用户禁用', () => {
  test('管理员可以禁用正常用户', async ({ page }) => {
    await page.goto('/users');

    const row = page.getByTestId('user-row-user001');

    await expect(row.getByTestId('user-status')).toHaveText('正常');
    await row.getByRole('button', { name: '禁用' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: '确认' }).click();
    await expect(row.getByTestId('user-status')).toHaveText('已禁用');
  });
});
```

---

## 12. 执行流程

`auto-e2e verify` 必须按以下顺序执行：

```text
1. 加载配置
2. 校验 task-spec.json
3. 检查项目环境
4. 读取 Git Diff
5. 分析需求和代码变更
6. 生成 test-plan.json
7. 启动或连接目标应用
8. 执行健康检查
9. 加载浏览器 Session
10. 使用 BetterWright 探索页面
11. 生成 Playwright Test
12. 执行生成测试
13. 收集 JSON、HTML、JUnit 和 Artifacts
14. 分析失败原因
15. 生成 result.json 和 summary.md
16. 返回退出码
```

### 12.1 应用启动策略

- 如果 `healthUrl` 已可访问，不重复启动。
- 如果不可访问，执行 `startCommand`。
- 后台启动进程。
- 轮询 `healthUrl`。
- 达到 `startupTimeout` 后终止并返回退出码 `2`。
- `auto-e2e` 启动的进程必须在执行结束后关闭。

---

## 13. 结果报告

### 13.1 result.json

```json
{
  "taskId": "TASK-20260729-001",
  "status": "failed",
  "mode": "incremental",
  "startedAt": "2026-07-29T03:00:00.000Z",
  "finishedAt": "2026-07-29T03:01:20.000Z",
  "summary": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "skipped": 0,
    "durationMs": 80000
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
      "message": "禁用用户仍然可以成功登录",
      "expected": "登录被拒绝",
      "actual": "跳转到 /dashboard",
      "confidence": 0.92,
      "artifacts": {
        "screenshot": ".auto-e2e/artifacts/TASK-001/login.png",
        "trace": ".auto-e2e/artifacts/TASK-001/trace.zip",
        "video": ".auto-e2e/artifacts/TASK-001/video.webm"
      }
    }
  ]
}
```

### 13.2 失败分类

```text
product_defect       业务缺陷
test_defect          测试脚本问题
environment_failure  环境或启动失败
data_failure         测试数据问题
auth_failure         登录或权限问题
browser_failure      浏览器执行问题
flaky                疑似不稳定测试
unknown              无法判断
```

### 13.3 summary.md

必须包含：

- 任务名称。
- 测试范围。
- 测试数量。
- 通过和失败数量。
- 验收标准覆盖情况。
- 失败摘要。
- 未覆盖风险。
- 报告和 Artifacts 路径。

---

## 14. 退出码

```text
0  测试全部通过
1  测试执行完成，但存在失败
2  应用环境启动失败
3  测试生成失败
4  需求或验收标准信息不足
5  登录或认证失败
6  BetterWright 或浏览器执行失败
7  配置错误
8  Playwright 执行异常
9  未知错误
```

所有命令都必须保证：

- 非交互模式下不会等待用户输入。
- 错误输出到 stderr。
- JSON 模式下 stdout 只输出最终 JSON。

---

## 15. Codex 集成规范

在目标项目中增加 Codex Skill 或 AGENTS.md 规则：

```text
每次完成需要页面验证的开发任务后：

1. 根据用户原始需求和实际代码变更生成：
   .auto-e2e/task-spec.json

2. task-spec.json 必须包含：
   - taskId
   - title
   - requirement
   - acceptanceCriteria
   - changedFiles
   - changedRoutes
   - changedApis
   - riskHints
   - startCommand
   - baseUrl

3. 执行：
   auto-e2e verify \
     --spec .auto-e2e/task-spec.json \
     --non-interactive \
     --json

4. 读取：
   .auto-e2e/reports/latest/result.json

5. 如果失败类型为 product_defect：
   - 分析是否由本次代码引起。
   - 修复业务代码。
   - 重新执行 auto-e2e verify。

6. 如果失败类型为 test_defect：
   - 不得修改业务逻辑迎合测试。
   - 调整 task-spec 或测试生成输入。

7. 最多自动修复并重试两轮。

8. 最终向用户报告：
   - 实现内容
   - 代码变更
   - 测试范围
   - 测试结果
   - 未覆盖风险
   - 报告路径
```

---

## 16. 开发阶段拆分

## 阶段一：CLI 骨架

目标：建立可安装、可执行的 CLI。

任务：

- 初始化 TypeScript 项目。
- 配置构建。
- 添加 `auto-e2e` bin。
- 实现命令路由。
- 实现统一日志。
- 实现退出码。
- 实现 `--json` 和 `--non-interactive`。

验收：

```bash
auto-e2e --help
auto-e2e init --help
auto-e2e verify --help
```

均可正常执行。

## 阶段二：配置和输入模型

目标：支持项目初始化和任务输入。

任务：

- 实现 config schema。
- 实现 task-spec schema。
- 实现配置加载和环境变量覆盖。
- 实现 `auto-e2e init`。
- 实现错误提示和退出码。

验收：

- 能生成默认配置。
- 缺少验收标准时返回退出码 `4`。
- 配置错误时返回退出码 `7`。

## 阶段三：Git 和项目检测

目标：分析目标项目环境。

任务：

- 读取 Git 根目录。
- 读取工作区 Diff。
- 获取 changed files。
- 检查 `package.json`。
- 检查 Playwright 配置。
- 实现项目启动和健康检查。

验收：

- 能输出真实 changed files。
- 应用已启动时不重复启动。
- 应用未启动时可自动启动。

## 阶段四：Pi 接入

目标：完成 ChatGPT OAuth 和结构化生成。

任务：

- 封装 Pi Client。
- 实现 OAuth 登录检查。
- 创建需求分析 Prompt。
- 创建 Test Plan Prompt。
- 使用 JSON Schema 或 Zod 限制输出。
- 实现 `test-plan.json` 生成。

验收：

- 能根据示例 task-spec 生成合法 test-plan。
- 所有验收标准均有覆盖映射。
- 输出不合法时最多重试一次。

## 阶段五：BetterWright 接入

目标：探索真实页面并输出结构化结果。

任务：

- 封装 BetterWright Client。
- 实现 Browser Session/Profile。
- 实现页面访问。
- 实现元素和定位器收集。
- 实现截图收集。
- 实现网络请求监听。
- 输出 exploration.json。

验收：

- 能访问测试项目。
- 能识别目标页面关键元素。
- 能输出至少一个推荐定位器。
- 登录状态可以复用。

## 阶段六：测试生成

目标：生成可运行的 Playwright Test。

任务：

- 创建测试生成 Prompt。
- 将 task-spec、test-plan、exploration 作为输入。
- 生成 TypeScript 测试。
- 使用 TypeScript Parser 或 `tsc --noEmit` 校验。
- 生成失败时返回退出码 `3`。

验收：

- 生成文件可通过 TypeScript 校验。
- 不出现明显固定 sleep。
- 不写入敏感信息。
- 测试标题和验收标准对应。

## 阶段七：测试执行和报告

目标：执行本次测试并生成完整结果。

任务：

- 调用 Playwright Test CLI。
- 配置 HTML、JSON、JUnit Reporter。
- 配置 Trace、截图和视频。
- 解析 Playwright JSON 结果。
- 生成 result.json。
- 生成 summary.md。

验收：

- 通过时返回 `0`。
- 失败时返回 `1`。
- HTML 报告可打开。
- result.json 字段完整。

## 阶段八：失败分析

目标：对失败结果进行初步分类。

任务：

- 收集错误堆栈。
- 收集测试步骤。
- 收集截图路径。
- 收集请求失败信息。
- 调用 Pi 进行失败分类。
- 输出 confidence。

验收：

- 能区分 product_defect 和 test_defect。
- 无法判断时使用 unknown。
- 失败分析不会覆盖原始 Playwright 错误。

## 阶段九：全量执行

目标：支持已有 Playwright 测试的全量执行。

任务：

- 实现 `auto-e2e run --all`。
- 复用项目原有 Playwright 配置。
- 输出统一报告。
- 不重新生成全部测试。

验收：

- 可执行目标项目全部 E2E 测试。
- 报告格式与增量模式一致。

## 阶段十：Codex 集成示例

目标：完成端到端演示。

任务：

- 提供示例 Web 项目。
- 提供示例 task-spec。
- 提供 Codex Skill 或 AGENTS.md 示例。
- 演示一次通过场景。
- 演示一次业务缺陷场景。

验收：

Codex 可以完成：

```text
开发
→ 生成 task-spec
→ 调用 auto-e2e
→ 读取 result.json
→ 根据结果返回用户
```

---

## 17. 自身测试要求

`auto-e2e` 自身至少要有以下单元测试：

- 配置文件解析。
- task-spec 校验。
- test-plan 校验。
- 退出码映射。
- Git Diff 解析。
- Playwright JSON 结果解析。
- failure category 解析。
- 报告生成。

集成测试至少包括：

- 一个测试页面正常通过。
- 一个断言失败。
- 一个应用启动失败。
- 一个认证失败。
- 一个测试生成结果不是合法 TypeScript。

---

## 18. 安全要求

- 不记录 ChatGPT OAuth Token。
- 不将 Cookie 和密码写入日志。
- 不将敏感配置写入生成测试。
- `.auto-e2e/auth` 必须加入 `.gitignore`。
- `.auto-e2e/artifacts` 默认加入 `.gitignore`。
- `allowSourceModification` 第一版固定为 `false`。
- Pi 和 BetterWright 只允许访问项目配置声明的 Base URL。
- 非交互模式下禁止弹出需要输入密码的流程。

建议 `.gitignore`：

```gitignore
.auto-e2e/auth/
.auto-e2e/artifacts/
.auto-e2e/reports/
.auto-e2e/generated/
```

是否提交 generated 测试，由后续版本决定。第一版默认不提交。

---

## 19. 第一版完成标准

第一版只有满足以下全部条件才算完成：

1. 可以通过 npm 安装或 `npx` 执行。
2. `auto-e2e init` 可以初始化目标项目。
3. 可以使用 ChatGPT OAuth 登录。
4. 可以读取合法 `task-spec.json`。
5. 可以读取 Git Diff。
6. 可以生成 `test-plan.json`。
7. 可以使用 BetterWright 探索页面。
8. 可以生成合法的 Playwright Test。
9. 可以执行本次增量测试。
10. 可以执行全量 Playwright 测试。
11. 可以生成 JSON、HTML 和 JUnit 报告。
12. 失败时可以保留截图、Trace 和视频。
13. 可以生成失败分类。
14. 可以通过退出码供 Codex 判断结果。
15. 可以完成一次 Codex 到 auto-e2e 的完整演示。

---

## 20. Codex 执行指令

将下面内容直接作为 Codex 的开发任务：

```text
请按照 auto-e2e 第一版开发计划实现项目。

执行要求：

1. 使用 TypeScript 和 Node.js 开发。
2. CLI 名称固定为 auto-e2e。
3. 第一版严格按照文档范围实现，不增加 WebUI、分布式测试、多浏览器等扩展能力。
4. Pi 负责 ChatGPT OAuth、需求分析、测试计划生成、测试代码生成和失败分析。
5. BetterWright 负责真实页面探索、Session 复用、定位器收集和证据采集。
6. @playwright/test 负责正式测试执行和报告。
7. 所有模型输出必须经过 Zod 校验。
8. 所有命令必须支持明确退出码。
9. verify 命令必须支持 --non-interactive 和 --json。
10. 不允许自动修改目标项目业务代码。
11. 不允许在日志和生成文件中写入密码、Cookie 和 OAuth Token。
12. 每完成一个开发阶段，都要补充对应单元测试。
13. 优先保证端到端闭环可用，不要过早抽象。

开发顺序：

阶段一：CLI 骨架
阶段二：配置和输入模型
阶段三：Git 和项目检测
阶段四：Pi 接入
阶段五：BetterWright 接入
阶段六：Playwright 测试生成
阶段七：执行和报告
阶段八：失败分析
阶段九：全量执行
阶段十：Codex 集成示例

每个阶段完成后：

- 运行 lint。
- 运行 TypeScript 类型检查。
- 运行单元测试。
- 更新 README。
- 输出本阶段完成内容和未完成风险。

最终必须提供：

- 可执行的 auto-e2e CLI。
- 完整 README。
- 示例配置。
- 示例 task-spec.json。
- 示例 Web 项目或测试夹具。
- Codex 集成示例。
- 一次增量测试演示结果。
- 一次全量测试演示结果。
```
