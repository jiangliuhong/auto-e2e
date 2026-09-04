# 配置与存储布局

项目中保存 `.auto-e2e/config.yaml`、`.auto-e2e/specs/` 和 `.auto-e2e/coverage/`。配置、用例及其输入和预期文件、覆盖核对的 `review.yaml` 建议纳入 Git；可重新生成的 `coverage/report.md` 可选提交。

运行历史、截图、下载文件和报告默认保存在 `~/.auto-e2e/projects/<workspaceId>/`，不需要提交。用户目录还包含工作区注册表 `workspaces.json`。BetterWright 的身份 Profile 和后端配置仍由 BetterWright 自己管理，不搬入项目配置或报告。

## 配置与路径优先级

配置文件依次选择：

1. 全局 `--config <path>` 指定的文件。
2. `.auto-e2e/config.yaml`。
3. 旧 `.auto-e2e.yaml`。
4. 没有文件时的默认配置。

只读取一个文件，不合并新旧配置。选中的文件损坏时报告错误，不回退；显式指定不存在的文件同样报错。Web UI 新建配置写入新位置，编辑已有配置时写回实际加载的文件。

配置文件路径及配置中的相对存储路径都以项目根目录为基准。绝对路径直接使用，`~/` 由程序展开为用户目录。移动配置文件不会改变相对路径含义。

每项存储路径按以下顺序解析：

1. 显式配置的 `acceptance.databasePath`、`report.outputDirectory`、`report.artifactDirectory`。
2. 设置了 `AUTO_E2E_HOME` 时，使用其下的 `projects/<workspaceId>/`。
3. 未设置该环境变量且项目 `.auto-e2e/` 已存在 `history.sqlite`（含 WAL、SHM、journal）、`artifacts` 或 `reports` 时，整套默认路径继续使用原来的项目目录。
4. 其余情况使用 `~/.auto-e2e/projects/<workspaceId>/`。

仅有 config、specs 或 coverage 不触发旧存储兼容。空的旧 artifacts/reports 目录也算旧存储标记。新配置省略默认存储路径；Web UI 保存时保留原有的省略项和自定义相对路径，不把解析出的个人默认绝对路径写入配置。

`AUTO_E2E_HOME` 同时控制工作区注册表和默认运行数据根目录；更改它会切换工作区列表，不自动搬运旧注册表。显式配置的存储路径不受此变量覆盖。

## 项目身份

`workspaceId` 是项目真实绝对路径的 SHA-256 摘要前 16 位，与工作区注册表使用相同算法。不同目录中的同名项目、不同 worktree 分别隔离；符号链接指向同一真实目录时共享 ID。

可在项目根目录通过 Node.js 查看 ID：

```bash
node --input-type=module -e 'import { realpathSync } from "node:fs"; import { createHash } from "node:crypto"; console.log(createHash("sha256").update(realpathSync(process.cwd())).digest("hex").slice(0,16))'
```

项目移动或重新 checkout 到不同绝对路径时，ID 会改变。可以迁移整个项目存储目录，或显式配置原有数据库和产物位置。不同机器不会自动同步运行数据。

## 迁移旧项目

只统一配置位置时，将 `.auto-e2e.yaml` 移到 `.auto-e2e/config.yaml`，保持配置内容不变。不要覆盖已经存在的新文件。旧运行数据会继续被识别，历史记录保持可用。

需要把旧默认运行数据也移到用户目录时：

1. 停止该项目的验收任务和报告服务，备份原配置及整套数据；确认目标目录没有另一份历史数据，避免覆盖或混合两个数据库。
2. 确定用户根目录和当前项目 ID，在 `<用户根目录>/projects/<workspaceId>/` 创建目标目录。
3. 将旧 `.auto-e2e/` 下的 `history.sqlite` 及存在的 `history.sqlite-wal`、`history.sqlite-shm`、`history.sqlite-journal`，连同 `artifacts/` 和 `reports/` 一起移动到目标目录，保持目录内部结构不变。备份放在旧存储检测范围外，不要只复制主数据库文件而遗漏尚未写回的数据。
4. 从配置中移除指向旧默认位置的三项存储路径，让程序使用用户目录默认值；保留 specs、coverage 和 config。旧位置不能残留数据库辅助文件或空 artifacts/reports 目录，否则会继续触发兼容模式。
5. 使用相同的 `AUTO_E2E_HOME` 设置运行 `auto-e2e list`、`auto-e2e show <run-id>` 和 `auto-e2e serve --workspace .`，确认历史、报告和截图可读后再处理备份。

旧默认布局中保存的 `.auto-e2e/artifacts/...` 相对引用，以及包含该前缀的绝对引用，Web UI 会映射到当前配置的 artifact 目录，因此不必编辑 SQLite 中的历史 JSON。迁移报告时须同时保留对应截图和下载文件。报告中的原始 proof 字符串不会被自动改写。

如果此前使用自定义存储目录，先保持原配置路径；任意自定义绝对 proof 路径或多次历史迁移不在上述旧默认路径映射范围内，不能仅移动数据库就视为迁移完成。

## CI

需要流水线收集产物时，为每次 Job 选择独立目录，并在配置中省略三项存储路径：

```bash
export AUTO_E2E_HOME="$CI_PROJECT_DIR/.auto-e2e-ci/$CI_JOB_ID/storage"
auto-e2e --project-root "$CI_PROJECT_DIR" --non-interactive --json doctor
auto-e2e --project-root "$CI_PROJECT_DIR" --non-interactive --json run
```

上传 `.auto-e2e-ci/<jobId>/storage/projects/` 即可包含数据库、报告及证据。CLI JSON stdout 可另行重定向到该 Job 的产物目录。`.auto-e2e-ci/` 应加入被测项目的 `.gitignore`。完整示例见 [push 到报告](push-to-report.md)。

需要长期历史的 Runner 和常驻报告服务应使用相同的用户根目录、项目真实路径及配置。CI checkout 路径变化会改变项目 ID；有意跨 checkout 共享历史时，应显式配置同一项目的存储位置。

## Git 忽略规则

为兼容旧项目，可保留：

```gitignore
/coverage/
.auto-e2e/history.sqlite*
.auto-e2e/artifacts/
.auto-e2e/reports/
.auto-e2e-ci/
```

不要使用 `.auto-e2e/` 或无前导斜杠的 `coverage/` 忽略整个验收定义及核对基线。
