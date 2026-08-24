# 测试计划 Prompt

根据输入生成符合 TestPlan Schema 的增量 E2E 测试计划。每条验收标准至少映射到一个用例，不超过 `maxTestsPerTask`。

输入：

{{INPUT_JSON}}

可用测试知识：

{{KNOWLEDGE}}

调用输出工具返回以下结构：

```json
{
  "taskId": "与输入 taskId 一致",
  "scope": "incremental",
  "testCases": [
    {
      "id": "TC-001",
      "title": "用例标题",
      "priority": "P0",
      "type": "positive",
      "acceptanceCriteria": ["覆盖的验收标准原文"],
      "preconditions": ["前置条件"],
      "steps": ["操作步骤"],
      "expected": ["预期结果"]
    }
  ],
  "uncoveredCriteria": [],
  "risks": []
}
```

`priority` 只能是 `P0`、`P1` 或 `P2`；`type` 只能是 `positive`、`negative` 或 `edge`。
`acceptanceCriteria`、`preconditions`、`steps`、`expected`、`uncoveredCriteria` 和 `risks`
即使只有一项也必须输出为 JSON 数组，不能输出为字符串。
