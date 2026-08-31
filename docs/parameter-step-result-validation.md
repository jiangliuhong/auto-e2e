# 参数、执行步骤与结果的完整验收方案

> 本文为早期讨论稿。当前实施采用更精简的 [Spec Bundle v2](spec-bundle-v2.md)：一个业务场景一个目录，以 `files -> steps -> results` 表达，不定义 Playwright 风格 action DSL。

## 背景

当前 task spec 支持 `inputs` 和 `outputs`：运行器可以暂存 Excel 等本地输入文件，并把预期页面输出转换成强制验收标准。这解决了“输入什么”和“最终期望什么”的问题，但中间执行过程仍主要依赖自然语言需求，存在以下不足：

- 无法结构化描述除文件以外的业务参数，以及参数是否真正用于页面操作。
- 无法验证步骤顺序、每一步的输入、完成状态和前置依赖。
- 页面实际值和期望值的比较主要由浏览器执行器判断，运行器不能确定性复算。
- 报告只能展示验收标准，不能完整回答“用了哪些参数、执行了哪些操作、每一步发生了什么、最终值为什么通过或失败”。

因此，建议把用例升级为三段式执行契约：

```text
Parameters（参数） -> Steps（执行步骤） -> Results（结果断言）
```

## 目标

一个验收用例必须能够证明：

1. 运行前参数合法、完整且可解析。
2. 浏览器按照声明顺序执行全部步骤，并验证每一步的预期页面状态。
3. 浏览器读取页面真实结果，auto-e2e 运行器使用结构化比较规则确定性判定结果。
4. 历史记录和 Web UI 可以分别展示参数、执行时间线与结果差异。

本方案仍保持黑盒验收边界：步骤使用用户可理解的语义目标，不要求业务代码信息，也不在用例中保存 CSS/XPath 等实现选择器。

## 建议的任务规格

```json
{
  "schemaVersion": 2,
  "taskId": "PL-FORECAST-01",
  "title": "P&L 预测锁定计算",
  "requirement": "上传预测模板，设置预测参数，执行锁定计算并验证结果。",
  "parameters": [
    {
      "id": "forecastFile",
      "name": "P&L 预测模板",
      "type": "file",
      "value": "fixtures/pl-forecast.xlsx"
    },
    {
      "id": "forecastMonth",
      "name": "预测月份",
      "type": "string",
      "value": "2026-08"
    },
    {
      "id": "lockVersion",
      "name": "锁定版本",
      "type": "string",
      "value": "V1"
    }
  ],
  "steps": [
    {
      "id": "STEP-01",
      "action": "navigate",
      "target": "P&L 预测页面",
      "expectedState": "页面显示预测模板上传区域"
    },
    {
      "id": "STEP-02",
      "action": "upload",
      "target": "预测模板上传控件",
      "value": { "$parameter": "forecastFile" },
      "expectedState": "页面显示模板上传成功"
    },
    {
      "id": "STEP-03",
      "action": "fill",
      "target": "预测月份",
      "value": { "$parameter": "forecastMonth" },
      "expectedState": "预测月份显示为 2026-08"
    },
    {
      "id": "STEP-04",
      "action": "select",
      "target": "锁定版本",
      "value": { "$parameter": "lockVersion" },
      "expectedState": "锁定版本显示为 V1"
    },
    {
      "id": "STEP-05",
      "action": "click",
      "target": "锁定计算按钮",
      "expectedState": "计算完成且页面显示成功状态",
      "timeoutMs": 120000
    }
  ],
  "results": [
    {
      "id": "RESULT-01",
      "name": "税前利润",
      "source": {
        "type": "visible-value",
        "target": "预测结果汇总区的税前利润"
      },
      "expected": 125000.25,
      "comparison": {
        "operator": "numeric",
        "tolerance": 0.01
      }
    },
    {
      "id": "RESULT-02",
      "name": "计算状态",
      "source": {
        "type": "visible-text",
        "target": "计算状态区域"
      },
      "expected": "已锁定",
      "comparison": {
        "operator": "equals"
      }
    }
  ]
}
```

## Parameters：参数契约

建议支持以下参数类型：

- `string`
- `number`
- `boolean`
- `date`
- `file`
- `json`

运行前由 auto-e2e 完成确定性校验：

- 参数 ID 在用例内唯一。
- 步骤引用的参数必须存在，且引用类型与动作兼容。
- 参数值符合声明类型。
- 文件参数是项目内的相对普通文件。
- 文件路径禁止绝对路径、目录穿越和逃逸项目目录的符号链接。
- 密码、Token、Cookie、OAuth 信息等敏感数据不得写入规格、数据库和报告。
- 未被任何步骤使用的参数应作为规格错误，避免“声明了输入但实际未使用”。

文件参数继续沿用现有安全暂存机制。非文件参数在生成执行 Prompt 前完成解析，浏览器执行器只接收已经验证的值。

## Steps：执行步骤契约

步骤描述“做什么”和“完成后页面应处于什么状态”。初始动作集合建议包括：

- `navigate`
- `upload`
- `fill`
- `select`
- `click`
- `wait`

每个步骤至少包含唯一 `id`、`action`、语义化 `target` 和可观察的 `expectedState`。需要输入值的动作通过 `value` 使用字面值或 `{ "$parameter": "parameterId" }` 引用参数。

浏览器执行器必须为每一步返回结构化记录：

```json
{
  "id": "STEP-02",
  "status": "passed",
  "actual": "页面显示文件 pl-forecast.xlsx 上传成功",
  "proof": "artifacts/STEP-02.png",
  "durationMs": 1842,
  "error": null
}
```

运行器必须验证：

- 返回的步骤 ID 与规格完全一致，不得遗漏、重复或虚构。
- 步骤按照规格顺序执行。
- 当前步骤的 `expectedState` 成立后才能进入下一步。
- 上传、提交、触发计算等关键动作必须保存 proof。
- 前置步骤未通过时，依赖步骤不得继续执行。

步骤状态语义：

- `passed`：动作执行成功，且预期页面状态成立。
- `failed`：动作已执行，但可观察页面状态不符合预期。
- `blocked`：登录、浏览器、页面不可操作或超时等原因导致无法执行。
- `skipped`：前置步骤未通过，因此没有执行。

## Results：结果契约

结果分为两部分：浏览器执行器负责读取实际值，auto-e2e 运行器负责比较。浏览器执行器不得自行决定预期值与实际值是否相等。

浏览器执行器返回：

```json
{
  "id": "RESULT-01",
  "actual": 125000.25,
  "proof": "artifacts/RESULT-01.png"
}
```

运行器根据规格中的 `expected` 和 `comparison` 计算状态。建议逐步支持：

- `equals`
- `contains`
- `numeric`
- `regex`
- `date`
- `json-subset`

数值比较规则固定为：

```text
abs(actual - expected) <= tolerance
```

实际值缺失、不可读取或无法转换为声明类型时，结果为 `blocked`；实际值读取成功但不匹配时，结果为 `failed`。

## 建议的运行结果

运行结果需要同时保存参数校验、步骤执行和结果比较，建议升级结果 schema：

```json
{
  "schemaVersion": 3,
  "status": "failed",
  "parameters": [
    {
      "id": "forecastFile",
      "status": "validated",
      "displayValue": "fixtures/pl-forecast.xlsx"
    }
  ],
  "steps": [
    {
      "id": "STEP-01",
      "status": "passed",
      "actual": "P&L 预测页面已打开",
      "proof": "artifacts/STEP-01.png"
    }
  ],
  "results": [
    {
      "id": "RESULT-01",
      "status": "failed",
      "expected": 125000.25,
      "actual": 124980.25,
      "comparison": {
        "operator": "numeric",
        "tolerance": 0.01
      },
      "difference": 20,
      "proof": "artifacts/RESULT-01.png"
    }
  ]
}
```

用例汇总状态按以下优先级计算：

1. 参数非法、输入文件不可用或步骤无法执行：`blocked`。
2. 步骤已执行但预期页面状态不成立：`failed`。
3. 任一最终结果不匹配：`failed`。
4. 全部参数、步骤和结果通过：`passed`。

工具自身异常仍使用 `error`，不与产品验收失败混淆。CLI 退出码继续遵循现有契约：通过为 `0`，验收失败为 `1`，环境或执行阻塞为 `2`，工具异常为 `3`。

## 与 acceptanceCriteria 的关系

新版规格中，`steps[].expectedState` 负责过程状态，`results[]` 负责最终确定性断言。`acceptanceCriteria` 可以在迁移期保留，用于无法表达为单一步骤或结构化结果的高层业务标准，但不应重复描述已经结构化的检查项。

后续可将 `acceptanceCriteria` 调整为可选字段：一个用例必须至少存在一条 `result` 或一条额外的 `acceptanceCriterion`，并且必须包含非空 `steps`。

## 迁移策略

建议采用一个版本的兼容迁移：

- 旧 `inputs` 转换为 `file` 类型的 `parameters`。
- 旧 `outputs` 转换为 `results`。
- 旧 `acceptanceCriteria` 暂时保留为额外验收项。
- 新建和 Web UI 保存的规格只生成新版 `parameters`、`steps`、`results`。
- 加载旧规格时给出弃用提示，但不阻塞运行。
- 下一个主版本删除旧字段解析。

如果希望继续维持严格 schema，也可以不做运行时双格式兼容，而提供一次性迁移命令；无论采用哪种方式，都不应长期维护两套内部执行模型。

## 实施范围

主要改造点如下：

- `src/domain/task-spec.ts`：增加参数、步骤、结果及引用的严格 Zod schema。
- `src/acceptance/requirement-loader.ts`：解析参数引用，将旧格式归一化为新版内部模型。
- `src/acceptance/betterwright-cli.ts`：生成逐步骤执行 Prompt，并要求返回步骤记录与结果实际值。
- `src/acceptance/acceptance-runner.ts`：执行前参数校验、步骤完整性检查和确定性结果比较。
- `src/domain/acceptance-run.ts`：新增参数、步骤和结果的运行记录 schema。
- `src/acceptance/history-store.ts`：持久化新版结构化结果。
- CLI、HTTP API 和 Web UI：展示参数表、步骤时间线、结果期望值/实际值/差异/proof。
- README、使用文档和 `auto-e2e-acceptance` Skill：同步新版规格与解释规则。

所有行为变更都需要覆盖 schema 校验、参数引用、文件安全、步骤完整性、比较器、状态聚合、历史兼容和 API 展示的回归测试，并在完成后运行：

```bash
npm run typecheck
npm test
npm run build
```

## 建议实施顺序

1. 定义新版 task spec 与 acceptance run schema。
2. 实现旧格式到新版内部模型的归一化。
3. 实现参数校验与引用解析。
4. 修改 BetterWright Prompt 和结构化返回契约。
5. 在运行器中实现步骤完整性检查和结果比较器。
6. 升级 SQLite、CLI、HTTP API 与 Web UI。
7. 更新 Skill、文档与迁移说明，并补齐回归测试。

完成后，auto-e2e 的验收证据链将从“提供输入并检查输出”升级为：

```text
验证参数
-> 使用参数执行声明的页面步骤
-> 逐步确认页面状态并保存 proof
-> 读取页面实际结果
-> 由运行器确定性比较
-> 保存可追溯的完整验收报告
```
