# GitHub Actions 自动发布到 npmjs

发布流程参考 [llm-wiki 的 tag 发布工作流](https://github.com/jiangliuhong/llm-wiki/blob/main/.github/workflows/release-macos.yml)，使用 tag 触发、版本校验和不取消进行中的发布任务。

## 触发规则

- PR 目标为 `main` 或推送到 `main`：运行 `.github/workflows/ci.yml`，在 Node.js 22.18.0 和 24 上执行安装、typecheck、测试、构建和打包检查；不会发布。
- 推送 `v*.*.*` tag：运行 `.github/workflows/release-npm.yml`。tag 必须等于 `v` 加 `package.json` 版本，lockfile 两处名称/版本必须一致，tag 对应提交必须已包含在远端 `main` 中。
- 未发布版本通过完整发布 dry-run 后才上传；稳定版使用 npm `latest`，含 `-` 的预发布版（如 `v0.4.0-rc.1`）使用 `next`。
- 已存在的版本会明确跳过，不重复上传，也不改动现有 dist-tag。跳过不表示当前 Git 提交与原发布产物相同。
- npm 查询只有结构化 `E404` 才视为版本未发布；登录、权限、网络或非法响应错误都会阻止发布。

工作流使用 GitHub-hosted Ubuntu、Node.js 24、固定 npm 11.6.0，不复用依赖缓存。发布采用 npm Trusted Publishing（OIDC），不调用需要传统登录态的 `npm whoami`。

## 首次启用：绑定 npm Trusted Publisher

仅提交 workflow 文件还不够，npm 包维护者还需要完成一次授权。进入 [`@jarome/auto-e2e` 的 Settings](https://www.npmjs.com/package/@jarome/auto-e2e/access)，在 **Trusted Publisher** 中选择 **GitHub Actions**：

| 字段 | 值 |
| --- | --- |
| Organization or user | `jiangliuhong`（GitHub 用户，不是 npm 用户 `jarome`） |
| Repository | `auto-e2e` |
| Workflow filename | `release-npm.yml`（不含目录） |
| Environment name | 留空（当前工作流未设置 environment） |
| Allowed actions | `npm publish` |

保存后无需设置 GitHub `NPM_TOKEN` Secret，也不需要在 Actions 中执行 `npm login`。工作流仅在发布 job 请求 `id-token: write`；`package.json` 的 `repository.url` 与本仓库对应，用于 provenance 校验。

授权配置和流程细节参见 [npm 官方 Trusted Publishing 文档](https://docs.npmjs.com/trusted-publishers/)。建议为 `main` 和 `v*` tag 配置 GitHub ruleset，限制谁可以合并和创建发布 tag；仅添加 YAML 不会自动开启分支保护。

## 发布新版本

1. 在开发分支更新版本及 CHANGELOG，例如 `npm version 0.3.1 --no-git-tag-version`。提交 `package.json`、`package-lock.json` 和发布说明，通过 PR 合并到 `main`，确认 CI 成功。
2. 在同步后的 `main` 上创建并推送带注释 tag：

   ```bash
   git switch main
   git pull --ff-only origin main
   git tag -a v0.3.1 -m "Release v0.3.1"
   git push origin v0.3.1
   ```

3. 在 GitHub Actions 查看 **Release npm package** 的执行结果；成功后运行 `npm view @jarome/auto-e2e@0.3.1 version --registry https://registry.npmjs.org` 验证。

`0.3.0` 已手动发布，不要试图覆盖同一版本；下一次发布使用新的版本号。tag 创建后必须推送到 GitHub 才触发。对应 tag 的提交必须包含本工作流；给尚未包含工作流的旧提交补 tag 不会补跑这份配置。

GitHub 发布授权尚未配置时，测试/构建可能通过，但最后的 publish 仍会失败。授权修正后可重跑同一失败任务；已经发布的版本会在 preflight 阶段跳过。本地手动发布仍使用 `npm run publish:npm`，它要求工作区干净及 npm 登录。
