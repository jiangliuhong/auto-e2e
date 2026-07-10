# CLI 使用指南

本指南面向**使用者**(开发者或外部编码 Agent),说明如何用 `auto-e2e` CLI 初始化项目、创建测试用例并执行。

> auto-e2e 是面向 Playwright 的 **Agent Runtime**。Runtime 负责**环境、观察、执行、反馈**,推理由你(或编码 Agent)完成。
> 测试用例本身仍是**标准 Playwright spec 文件**;auto-e2e 负责「把环境准备好」并「把结果结构化」。

---

## 前置要求

- Node.js `>= 20`
- 一个支持 Playwright 的项目(可选安装 `@playwright/test`)
- 已安装浏览器:`npx playwright install`

## 安装

```bash
# 作为项目依赖(推荐)
pnpm add -D auto-e2e @playwright/test

# 或全局安装 CLI
pnpm add -g auto-e2e
```

安装后即可使用 `auto-e2e <command>`。开发模式下也可用 `pnpm dev <command>` 直接运行源码。

---

## 总览:完整工作流

一个典型周期是这五步(从文本用例出发时,在 `prepare` 与 `run` 之间加一步 `generate`):

```text
1. init      → 初始化 .auto-e2e/ 与 config.json
2. doctor    → 自检环境是否就绪
3. scan      → 扫描项目结构,生成 app-map / selector-map / agent-context
4. prepare   → 启动 dev server 并等待就绪
5. run       → 执行 Playwright 测试,产出 run-result.json
```

> 如果你手里是一条**文本用例**而非现成的 spec,可用 `auto-e2e generate` 把它转成「Spec 生成指令包」,交给编码 Agent 编写标准 spec 后再 `run`。详见下文「从文本用例生成 Spec 指令包」。

对应的命令串起来就是:

```bash
auto-e2e init
auto-e2e doctor
auto-e2e scan
auto-e2e prepare
auto-e2e run
```

> 所有 Runtime 产物统一写入 `.auto-e2e/`(详见 [`OUTPUT_SPEC.md`](./OUTPUT_SPEC.md))。请把该目录加入 `.gitignore`(初始化时也会提醒)。

---

## 第 1 步:初始化项目

```bash
auto-e2e init
```

- 在当前目录创建 `.auto-e2e/` 完整目录布局。
- 写入默认 `.auto-e2e/config.json`。
- **幂等**:已存在 `config.json` 时默认**不会覆盖**(保留你的自定义配置)。

| 选项                      | 说明                                      | 默认         |
| ------------------------- | ----------------------------------------- | ------------ |
| `--root <path>`           | 项目根目录                                | 当前工作目录 |
| `--force`                 | 覆盖已存在的 `config.json`                | `false`      |
| `--agent-platform <name>` | 编码 Agent 平台(`codex`/`claude`/`zcode`) | `codex`      |

示例:

```bash
auto-e2e init --root ./my-app --force
```

初始化后的 `config.json`(默认值):

```json
{
  "baseUrl": "http://localhost:3000",
  "playwrightConfig": "playwright.config.ts",
  "browser": "chromium",
  "viewport": { "width": 1280, "height": 720 }
}
```

可配置字段(均可选):

| 字段               | 类型                                | 说明                              |
| ------------------ | ----------------------------------- | --------------------------------- |
| `baseUrl`          | string (URL)                        | dev server 探测地址               |
| `devCommand`       | string                              | 启动 dev server 的命令            |
| `playwrightConfig` | string                              | Playwright 配置文件路径           |
| `browser`          | `chromium` \| `firefox` \| `webkit` | 默认浏览器                        |
| `viewport`         | `{ width, height }`                 | 视口尺寸                          |
| `storageState`     | string                              | 复用的 storageState 文件路径      |
| `agentPlatform`    | `codex` \| `claude` \| `zcode`      | 编码 Agent 平台,决定 skill 根目录 |

---

## 第 2 步:环境自检

```bash
auto-e2e doctor
```

检查 Node、包管理器、Playwright、浏览器、`baseUrl` 可达性等条件,逐项输出 ✓ / ✗。

| 选项                  | 说明                      | 默认    |
| --------------------- | ------------------------- | ------- |
| `--root <path>`       | 项目根目录                | cwd     |
| `--skip-reachability` | 跳过 `baseUrl` 可达性检查 | `false` |

退出码:`0` 全部通过,`1` 有失败项。建议在 `prepare` / `run` 之前先跑一次 `doctor`,及早暴露缺失的依赖。

---

## 第 3 步:扫描项目结构

```bash
auto-e2e scan
```

扫描项目结构并产出三类文件(写入 `.auto-e2e/`):

| 产物                | 内容                                                         |
| ------------------- | ------------------------------------------------------------ |
| `app-map.json`      | 框架、包管理器、scripts、路由、API 路由、Playwright 配置信息 |
| `selector-map.json` | 静态选择器(主要是 `data-testid`),含置信度                    |
| `agent-context.md`  | 上述内容的人类/Agent 可读摘要(供编写用例时参考)              |

> 同时生成 `codex-context.md`(内容相同,向后兼容别名)。

| 选项            | 说明       | 默认 |
| --------------- | ---------- | ---- |
| `--root <path>` | 项目根目录 | cwd  |

**这一步对「创建测试用例」至关重要**:`selector-map.json` 告诉你哪些 `data-testid` 可用,`app-map.json` 告诉你有哪些路由可以测。详见下文「创建测试用例」。

---

## 第 4 步:准备环境(启动 dev server)

```bash
auto-e2e prepare
```

启动 dev server 并轮询 `baseUrl` 直到就绪,同时创建 `storageState` 占位文件。

| 选项                  | 说明                               | 默认     |
| --------------------- | ---------------------------------- | -------- |
| `--root <path>`       | 项目根目录                         | cwd      |
| `--base-url <url>`    | 覆盖 `config.baseUrl` 进行就绪探测 | —        |
| `--dev-command <cmd>` | 覆盖 `config.devCommand`           | —        |
| `--timeout <ms>`      | 就绪探测超时(毫秒)                 | 内置默认 |
| `--cleanup`           | 停止受管的 dev server 后退出       | `false`  |

示例:

```bash
# 用自定义命令启动并指定超时
auto-e2e prepare --dev-command "npm run dev" --base-url http://localhost:8080 --timeout 60000

# 测完停止受管的 dev server
auto-e2e prepare --cleanup
```

---

## 从文本用例生成 Spec 指令包

如果你手里有一条**文本用例**(自然语言描述,例如「用户登录后应跳转到 /dashboard」),`auto-e2e generate` 可以把它转换成一份**「Spec 生成指令包」**,供编码 Agent 据此编写标准 Playwright spec。

> auto-e2e 是 Runtime,**不做推理、不调用 LLM**。`generate` 只负责把你的文本用例 + 项目上下文(来自 `scan` 的路由/选择器)+ Playwright 编写规范**结构化打包**成 Markdown;spec 代码由编码 Agent(或你自己)依据指令包编写,之后用 `auto-e2e run --spec` 执行。

### 用法

```bash
# 文本内联
auto-e2e generate --name login --case "用户用 demo/demo1234 登录,应跳转到 /dashboard"

# 文本来自文件(适合长用例)
auto-e2e generate --name checkout --case-file docs/cases/checkout.md

# 指定 spec 输出目录 / 覆盖已有指令包
auto-e2e generate --name login --case "..." --spec-dir e2e/specs --force
```

| 选项                 | 说明                                              | 默认                              |
| -------------------- | ------------------------------------------------- | --------------------------------- |
| `--name <name>`      | 用例名称(必填),同时作为指令包文件名与建议 spec 名 | —                                 |
| `--case <text>`      | 文本用例内容(与 `--case-file` 二选一)             | —                                 |
| `--case-file <file>` | 文本用例文件路径(与 `--case` 二选一)              | —                                 |
| `--spec-dir <dir>`   | 覆盖建议的 spec 输出目录                          | `app-map` 的 `testDir`,回退 `e2e` |
| `--root <path>`      | 项目根目录                                        | cwd                               |
| `--force`            | 覆盖已存在的指令包                                | `false`                           |

执行后会输出:

```text
✓ 指令包已生成:login
agent-brief: /path/.auto-e2e/spec-briefs/login.md
建议 spec 路径: /path/e2e/login.spec.ts
下一步: 由编码 Agent 依据指令包编写 spec,再执行 `auto-e2e run --spec /path/e2e/login.spec.ts`
```

产物:`.auto-e2e/spec-briefs/<name>.md`(详见 [`OUTPUT_SPEC.md`](./OUTPUT_SPEC.md))。若尚未执行 `scan`,`generate` 会**自动触发一次 scan** 以补充路由/选择器上下文。

### 从文本用例到执行的完整流程

```text
1. auto-e2e generate --name <name> --case "..."   →  生成指令包 spec-briefs/<name>.md
2. (编码 Agent 读指令包)                          →  编写 e2e/<name>.spec.ts
3. auto-e2e run --spec e2e/<name>.spec.ts         →  执行并产出 run-result.json + 报告
```

---

## Skill 命令:基于项目 skill 生成结构化用例

`auto-e2e skill` 让你在**项目内维护可复用的「用例编写 skill」**(SKILL.md + references),由 auto-e2e 读取并据此生成**「用例编写指令包」**(一份给编码 Agent 的 Markdown prompt),再由编码 Agent 编写出符合 **auto-e2e 用例契约**的 Markdown 用例。

> 这与 `generate` 的区别:`generate` 产出的是「Spec 生成指令包」(给 Agent 写 `.spec.ts`);`skill generate` 产出的是「用例编写指令包」(给 Agent 写结构化 Markdown 用例),是 `generate` 之上的一层**用例契约化**能力。Runtime 仍不做推理,只做组装。

### 平台目录约定

skill 按编码 Agent 平台放在项目内的隐藏目录下,**安装时由 `auto-e2e init --agent-platform` 选择**:

```text
.codex/skills/<skill-name>/      # Codex
.claude/skills/<skill-name>/     # Claude Code
.zcode/skills/<skill-name>/      # ZCode
  ├── SKILL.md                   # skill 规则正文(frontmatter description 可选)
  └── references/
      ├── case-schema.md         # 用例契约补充规则(可选)
      ├── project-rules.md       # 项目专属规则(可选)
      └── auth-rules.md          # 鉴权规则(可选)
```

`config.json` 的 `agentPlatform` 字段决定 auto-e2e 去哪个目录找 skill(默认 `codex`)。

### 用例契约(auto-e2e skill 固定支持的结构)

```markdown
# 用例标题

## Target

- route: /global/pl-report/parameters?country=mx
- module: pl-forecast
- type: readonly-smoke

## Preconditions

- app: web + api development server
- auth: use development login helper

## Steps

1. 登录具备菜单权限的用户。
2. 打开 `/global/pl-report/parameters?country=mx`。

## Assertions

- 页面标题可见。

## Network Expectations

- GET /api/pl/forecast/parameter-sets

## Stability Notes

- 优先使用 role、label、visible text。
- 禁止使用绝对 XPath、动态 id。

## Write Operations # 仅当 Steps 含写操作时必填

- testData: 由 fixture 提供唯一名
- cleanup: 测试后删除该记录
- idempotent: true
```

**必填段**:`Target` / `Preconditions` / `Steps` / `Assertions` / `Stability Notes`。缺一即校验失败。
**写操作守门**:Steps 含写入语义(创建/修改/删除/提交/submit/save 等)时,必须声明 `Write Operations`(`testData` + `cleanup` + `idempotent`),否则校验失败。

### 命令

```bash
# 列出已安装的 skill(读 config.agentPlatform 指定的目录)
auto-e2e skill list
auto-e2e skill list --platform claude       # 覆盖平台

# 校验用例 Markdown 是否符合契约(可同时校验 skill 存在性)
auto-e2e skill validate --case-file tests/auto-e2e-cases/pl/detail.md
auto-e2e skill validate --case-file ... --skill auto-e2e-case-writer

# 依据 skill + target,生成「用例编写指令包」
auto-e2e skill generate \
  --skill auto-e2e-case-writer \
  --target "PL Forecast 参数集详情页" \
  --route "/global/pl-report/parameters?country=mx" \
  --slug pl-detail
```

| 命令/选项            | 说明                                                    |
| -------------------- | ------------------------------------------------------- |
| `skill list`         | 列出已发现的 skill                                      |
| `--platform <name>`  | 覆盖 `config.agentPlatform`(`codex`/`claude`/`zcode`)   |
| `skill validate`     | 校验用例 Markdown 契约                                  |
| `--skill <name>`     | 同时校验该 skill 存在                                   |
| `--case <text>`      | 内联用例 Markdown(与 `--case-file` 二选一)              |
| `--case-file <file>` | 用例 Markdown 文件路径                                  |
| `skill generate`     | 生成用例编写指令包                                      |
| `--skill <name>`     | (必填)skill 名称                                        |
| `--target <text>`    | (必填)用例目标的自然语言描述                            |
| `--slug <slug>`      | 用例 slug(留空则从 target 派生)                         |
| `--route <route>`    | 目标路由                                                |
| `--case-dir <dir>`   | 覆盖建议的最终用例输出目录(默认 `tests/auto-e2e-cases`) |
| `--force`            | 覆盖已存在的指令包                                      |
| `--project <path>`   | 项目根目录(`--root` 的别名,默认 cwd)                    |

### 从 skill 到用例的完整流程

```text
1. auto-e2e init --agent-platform codex            →  写入 config.agentPlatform
2. (在 .codex/skills/<skill>/ 编写 SKILL.md)        →  定义用例编写规则
3. auto-e2e skill generate --skill <skill> --target →  生成指令包 .auto-e2e/case-briefs/<slug>.md
4. (编码 Agent 读指令包)                            →  编写 tests/auto-e2e-cases/<module>/<slug>.md
5. auto-e2e skill validate --case-file <路径>       →  校验用例契约
```

> `skill generate` 产出的指令包落在 `.auto-e2e/case-briefs/<slug>.md`;最终用例 `tests/auto-e2e-cases/...` 由编码 Agent 编写(可提交的源码资产)。若未跑过 `scan`,`skill generate` 会**自动触发一次 scan** 以补充项目上下文。

---

## 从 Markdown 用例编译 spec 骨架

当你已经有了一份**符合 auto-e2e 用例契约的 Markdown 用例**(经 `skill validate` 通过),`auto-e2e compile` 可以把它**确定性**编译为 Playwright `.spec.ts` 骨架。

> auto-e2e 是 Runtime,**不做推理**。compile 只做模板映射:凡是契约/config 已显式给出的(route→goto、Network Expectations→拦截断言、viewport/storageState→test.use)都做实;凡是需要应用语义的(真实定位器、断言选择器)都留 `TODO` + 契约原文。**compile 前会强制校验契约**,缺必填段或写操作未声明 → 拒绝编译。

### 用法

```bash
auto-e2e compile tests/auto-e2e-cases/pl-forecast/detail.md \
  --out tests/auto-e2e-generated/detail.spec.ts
```

| 选项            | 说明                              | 默认  |
| --------------- | --------------------------------- | ----- |
| `<caseFile>`    | 用例 Markdown 文件(位置参数,必填) | —     |
| `--out <file>`  | spec 输出路径(必填,相对项目根)    | —     |
| `--root <path>` | 项目根目录                        | cwd   |
| `--force`       | 覆盖已存在的 spec                 | false |

执行后输出:

```text
✓ spec 骨架已生成:detail
spec: /abs/tests/auto-e2e-generated/detail.spec.ts
下一步: 由编码 Agent 补全 TODO(真实选择器与断言),再执行 `auto-e2e run --spec tests/auto-e2e-generated/detail.spec.ts`
```

产物形如(骨架 + TODO):

```ts
import { test, expect } from '@playwright/test'

test.use({
  viewport: { width: 1280, height: 720 },
  storageState: '.auth/state.json',
})

test.describe('PL 参数集详情页', () => {
  test('detail', async ({ page }) => {
    const errorResponses: number[] = []
    page.on('response', (response) => {
      if (response.status() >= 400) errorResponses.push(response.status())
    })

    let api_pl_forecast_parameter_setsCount = 0
    await page.route('**/api/pl/forecast/parameter-sets', async (route) => {
      api_pl_forecast_parameter_setsCount += 1
      await route.continue()
    })

    await page.goto('/global/pl-report/parameters?country=mx')

    await test.step('1. 登录具备菜单权限的用户。', async () => {
      /** TODO: 实现该步骤。契约原文:登录具备菜单权限的用户。 */
    })

    // TODO: 页面标题可见。
    await expect(page.getByText(/.*/).first()).toBeVisible() // 占位

    expect(api_pl_forecast_parameter_setsCount).toBeGreaterThan(0)
    expect(errorResponses).toEqual([])
  })
})
```

> spec 骨架是**可提交的源码资产**(默认放 `tests/auto-e2e-generated/`),不属于 `.auto-e2e/`。补全 TODO 后用 `auto-e2e run --spec <路径>` 执行。

### 从 Markdown 用例到执行的完整流程

```text
1. auto-e2e skill generate / validate        →  得到合法的 Markdown 用例
2. auto-e2e compile <case.md> --out <spec>    →  生成 spec 骨架
3. (编码 Agent 补全 TODO)                     →  真实选择器与断言
4. auto-e2e run --spec <spec>                 →  执行并产出 run-result.json + 报告
```

---

## 创建测试用例

auto-e2e **不发明新的测试格式**。测试用例就是**标准 Playwright spec 文件**(`.spec.ts`)。

### 推荐流程

1. **先 `auto-e2e scan`** —— 拿到 `selector-map.json` 与 `app-map.json`。
2. **阅读 `.auto-e2e/agent-context.md`** —— 了解可用路由与选择器。
3. **在项目的 E2E 目录中新建 spec 文件**(位置以你项目的 Playwright `testDir` 为准,通常为 `e2e/`)。
4. **优先使用稳定选择器**(对齐 AGENTS.md 的 Playwright 规则):
   - `getByRole` / `getByLabel` / `getByPlaceholder`
   - `data-testid`(可从 `selector-map.json` 查到)
5. **避免**:CSS 类名、`nth-child`、过长的选择器、任意超时。

### 示例:登录用例

假设 `selector-map.json` 显示页面有 `data-testid="login-submit"`,路由 `/login` 存在:

```ts
// e2e/login.spec.ts
import { test, expect } from '@playwright/test'

test('登录成功', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('用户名').fill('demo')
  await page.getByLabel('密码').fill('demo1234')
  await page.getByTestId('login-submit').click()

  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('heading', { name: '欢迎' })).toBeVisible()
})
```

> 选择器如不在 `selector-map.json` 中,优先用语义定位器(`getByRole` / `getByLabel`);如需新增稳定锚点,建议在源码中补 `data-testid` 后**重新 `auto-e2e scan`**。

---

## 第 5 步:执行测试

### 执行全部用例

```bash
auto-e2e run
```

### 执行指定用例

```bash
# 只跑某个 spec 文件
auto-e2e run --spec e2e/login.spec.ts

# 只跑某个 suite
auto-e2e run --suite login

# 按 tag 过滤
auto-e2e run --tag smoke
```

### 全部选项

| 选项                 | 说明                                     | 默认             |
| -------------------- | ---------------------------------------- | ---------------- |
| `--root <path>`      | 项目根目录                               | cwd              |
| `--spec <file>`      | 仅运行指定 spec 文件                     | —                |
| `--suite <name>`     | 仅运行指定 suite                         | —                |
| `--tag <grep>`       | 按 tag(grep)过滤测试                     | —                |
| `--headed`           | 有头模式运行浏览器                       | `false`          |
| `--browser <name>`   | 覆盖浏览器:`chromium`/`firefox`/`webkit` | `config.browser` |
| `--update-snapshots` | 更新快照基线                             | `false`          |
| `--retries <n>`      | 失败重试次数                             | Playwright 默认  |

执行后输出形如:

```text
✓ 测试完成:passed(总计 5,通过 4,失败 1,跳过 0)
run id: run_001
run-result: /path/.auto-e2e/run-result.json
归档报告: /path/.auto-e2e/reports/run_001/run-result.json
失败用例 1 个:
  - 登录成功 (e2e/login.spec.ts:12)
```

### 结果产物

| 产物                                         | 说明                                       |
| -------------------------------------------- | ------------------------------------------ |
| `.auto-e2e/run-result.json`                  | 最近一次运行的顶层快照                     |
| `.auto-e2e/reports/<run-id>/run-result.json` | 按 `runId` 归档的历史报告                  |
| `run-result.json` 中的 `failures[]`          | 每条失败含标题、文件、行号、错误信息、产物 |

退出码:有运行错误或测试失败(`status === 'failed'`)→ `1`;否则 `0`。

### 针对失败用例定位

1. 打开 `.auto-e2e/run-result.json`,查看 `failures[].file` / `line` / `message`。
2. 失败记录的 `artifacts` 指向 Playwright 生成的 trace / 截图。
3. 用 trace 查看:`npx playwright show-trace <trace.zip>`。

---

## 常见场景

### 场景 A:CI 中一键跑通

```bash
auto-e2e init --force
auto-e2e doctor --skip-reachability   # CI 中 dev server 尚未启动
auto-e2e scan
auto-e2e prepare --timeout 120000
auto-e2e run
auto-e2e prepare --cleanup            # 收尾,停掉 dev server
```

### 场景 B:本地调试单个失败用例

```bash
auto-e2e prepare                      # 启动 dev server
auto-e2e run --spec e2e/login.spec.ts --headed --retries 0
```

### 场景 C:不同浏览器回归

```bash
auto-e2e run --browser firefox
auto-e2e run --browser webkit
```

---

## 开发模式 / 编程式使用

开发期无需构建,直接用源码运行:

```bash
pnpm dev <command>        # 例如 pnpm dev run --spec e2e/login.spec.ts
```

Runtime 也可作为库使用(详见 [`RUNTIME_SPEC.md`](./RUNTIME_SPEC.md)):

```ts
import { createRuntime } from 'auto-e2e'

const runtime = createRuntime({ projectRoot: process.cwd() })
await runtime.scan()
await runtime.prepare()
const result = await runtime.run({ spec: 'e2e/login.spec.ts' })
console.log(result.status, result.summary)
```

---

## 命令一览

| 命令                | 作用                                     | 状态            |
| ------------------- | ---------------------------------------- | --------------- |
| `auto-e2e init`     | 初始化 `.auto-e2e/` 与 `config.json`     | ✅              |
| `auto-e2e doctor`   | 环境自检                                 | ✅              |
| `auto-e2e scan`     | 扫描项目结构,生成 app-map / selector-map | ✅              |
| `auto-e2e prepare`  | 启动 dev server 并等待就绪               | ✅              |
| `auto-e2e generate` | 文本用例 → Spec 生成指令包               | ✅              |
| `auto-e2e skill`    | 管理 skill:list / validate / generate    | ✅              |
| `auto-e2e compile`  | Markdown 用例 → spec 骨架                | ✅              |
| `auto-e2e run`      | 执行 Playwright 测试                     | ✅              |
| `auto-e2e observe`  | 页面观察                                 | ⏳ 路线图阶段 4 |
| `auto-e2e report`   | 反馈报告                                 | ⏳ 路线图阶段 6 |

获取帮助:

```bash
auto-e2e --help
auto-e2e <command> --help      # 例如 auto-e2e run --help
auto-e2e --version
```
