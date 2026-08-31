# Spec Bundle v2

auto-e2e 使用自有的 Spec Bundle 描述业务验收，不依赖 OpenSpec，也不生成 Playwright 测试。一个目录代表一个独立、可复制、可复现的业务场景。

```text
.auto-e2e/specs/pl-forecast-lock/
├── spec.json
├── inputs/
│   └── forecast-input.xlsx
└── expected/
    └── locked-result.xlsx
```

## 设计边界

- `steps` 描述业务意图和完成状态，不描述 click、fill、selector 或 XPath。
- `files` 只引用当前 bundle 内的普通文件，禁止绝对路径、`..` 和符号链接逃逸；单文件上限 100 MiB，引用文件总量上限 500 MiB。
- `results` 描述实际值来源、预期值和比较方式。
- `equals`、`contains`、`numeric` 由 auto-e2e 运行器复算。
- `visual`、`table`、`file` 当前由 BetterWright 比较并提供 proof；以后可由隔离的格式适配器接管确定性比较。
- 登录状态由 BetterWright Profile 管理，凭据不得写入 bundle。
- 截图、下载文件和差异报告写入 `.auto-e2e/artifacts`，不得回写 bundle。

## 完整示例

```json
{
  "schemaVersion": 2,
  "taskId": "PL-FORECAST-LOCK-01",
  "title": "P&L 预测试算与锁定",
  "requirement": "上传预测数据，完成试算和锁定，并核对锁定结果。",
  "requirementIds": ["REQ-PL-102"],
  "tags": ["pl", "forecast", "critical"],
  "risk": "high",
  "files": [
    {
      "id": "forecast-input",
      "name": "预测输入文件",
      "role": "input",
      "path": "inputs/forecast-input.xlsx"
    },
    {
      "id": "expected-result",
      "name": "预期锁定结果",
      "role": "expected",
      "path": "expected/locked-result.xlsx"
    }
  ],
  "steps": [
    {
      "id": "STEP-01",
      "instruction": "使用已有登录状态进入 P&L 预测页面",
      "expected": "预测页面正常显示"
    },
    {
      "id": "STEP-02",
      "instruction": "新建预测参数集并上传预测输入文件",
      "uses": ["forecast-input"],
      "expected": "参数集创建成功，文件上传并解析完成"
    },
    {
      "id": "STEP-03",
      "instruction": "执行试算并查看试算结果",
      "expected": "试算完成且没有计算错误"
    },
    {
      "id": "STEP-04",
      "instruction": "锁定预测并查看锁定结果",
      "expected": "锁定成功，状态显示为已锁定"
    }
  ],
  "results": [
    {
      "id": "RESULT-01",
      "name": "锁定状态",
      "actual": "页面参数集状态",
      "expected": "已锁定",
      "match": "equals",
      "options": { "trim": true }
    },
    {
      "id": "RESULT-02",
      "name": "锁定结果",
      "actual": "页面锁定结果表格",
      "expected": {
        "file": "expected-result",
        "sheet": "锁定结果"
      },
      "match": "table",
      "options": {
        "keyColumns": ["科目编码", "月份"],
        "ignoreRowOrder": true,
        "numericTolerance": 0.01
      }
    }
  ]
}
```

## 发现与执行

- 默认递归扫描 `.auto-e2e/specs/**/spec.json`。
- 发现 `spec.json` 后，该目录成为 bundle 边界，不再向下寻找其他 spec。
- `taskId` 在一次套件中必须唯一。
- `auto-e2e run --spec <bundle-directory>` 执行一个 bundle。
- 为迁移兼容，旧的 `.auto-e2e/specs/*.spec.json` 暂时仍可读取；新建用例只生成 bundle。

运行历史保存 spec 和所有引用文件的 SHA-256 摘要。相同代码但摘要不同的运行不视为同一个测试输入版本。
