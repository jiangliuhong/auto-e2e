# 失败分析 Prompt

根据输入诊断 E2E 测试失败。类别只能是 `product_defect`、`test_defect`、`environment_failure`、`data_failure`、`auth_failure`、`browser_failure`、`flaky`、`unknown`。

输入：

{{INPUT_JSON}}

调用输出工具返回 `test`、`category`、`message`、可选 `expected`/`actual`、以及 0 到 1 的 `confidence`。
