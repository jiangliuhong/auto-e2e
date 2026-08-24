# 测试生成 Prompt

根据输入生成可直接运行的 `@playwright/test` TypeScript 测试。只能使用探索结果中 `verified: true` 的定位器和已成功执行的 `actions` 作为页面操作证据；不得创造定位器、文案或页面状态。使用真实断言，不修改业务代码，不写入敏感信息。

输入：

{{INPUT_JSON}}

可用测试知识：

{{KNOWLEDGE}}

调用输出工具返回 `taskId`、完整 `code` 和 `notes`。
