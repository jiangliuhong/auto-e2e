# Codex 集成 auto-e2e 示例

> 将本文件内容加入目标项目的 `AGENTS.md` 或 Codex Skill，指导 Codex 在完成开发后调用 auto-e2e。

每次完成需要页面验证的开发任务后：

1. **生成 task-spec.json**

   根据用户原始需求和实际代码变更生成：

   ```text
   .auto-e2e/task-spec.json
   ```

   > 字段规范以 `auto-e2e spec schema --json` 的输出为权威来源（从代码同源反射，不会过时）。

   task-spec.json 字段：
   - 必填：`taskId` / `title` / `requirement` / `acceptanceCriteria`（非空）/ `changedFiles`
   - 可选：`changedRoutes` / `changedApis` / `riskHints` / `startCommand` / `baseUrl`

2. **执行 auto-e2e verify**

   ```bash
   auto-e2e verify \
     --spec .auto-e2e/task-spec.json \
     --non-interactive \
     --json
   ```

3. **读取结果**

   ```text
   .auto-e2e/reports/latest/result.json
   ```

4. **按失败类型处理**

   - 如果失败类型为 `product_defect`：
     - 分析是否由本次代码引起。
     - 修复业务代码。
     - 重新执行 `auto-e2e verify`。
   - 如果失败类型为 `test_defect`：
     - **不得**修改业务逻辑迎合测试。
     - 调整 task-spec 或测试生成输入。

5. **重试上限**

   最多自动修复并重试两轮。

6. **最终向用户报告**

   - 实现内容
   - 代码变更
   - 测试范围
   - 测试结果
   - 未覆盖风险
   - 报告路径（`.auto-e2e/reports/latest/summary.md`）

---

## 退出码速查

| Code | 含义 | Codex 处理建议 |
|---|---|---|
| 0 | 全部通过 | 直接向用户报告成功 |
| 1 | 存在失败 | 读取 result.json，按 failure.category 处理 |
| 2 | 启动失败 | 检查 startCommand / healthUrl |
| 3 | 生成失败 | 检查 task-spec 是否充分，必要时调整探索输入 |
| 4 | 需求不足 | 补充 acceptanceCriteria 后重试 |
| 5 | 认证失败 | 提示用户执行 `auto-e2e auth login` |
| 6 | 浏览器失败 | 检查 BetterWright 是否安装 / baseUrl 是否可达 |
| 7 | 配置错误 | 检查 `.auto-e2e/config.yaml` |
| 8 | Playwright 异常 | 检查项目 Playwright 环境 |
| 9 | 未知错误 | 查看完整日志 |
