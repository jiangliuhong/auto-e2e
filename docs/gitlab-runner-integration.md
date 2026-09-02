# 本地 auto-e2e 与 GitLab Runner 集成方案

> 状态：设计方案，尚未全部实现。
>
> 本文中的 `AUTO_E2E_STORAGE_ROOT`、`run --ci-report-directory`、JUnit 导出和验收覆盖率展示属于待实现能力；现有的 `doctor`、`run`、结构化结果、退出码、SQLite 历史和 `serve` 报告能力可以直接复用。

## 1. 目标与约束

auto-e2e 只能部署并运行在本地机器上。GitLab 的 `master` 分支收到 push 后，需要在这台机器上检出对应 commit、执行需求验收，并满足以下要求：

- GitLab Job 能判断验收通过、失败、阻塞或工具异常。
- GitLab 能显示本次运行的完整用例情况，并下载 JSON、JUnit 和 proof。
- 常驻的 `auto-e2e serve` 能查看跨多次 Pipeline 的全部历史。
- 报告包含用例、步骤和结果断言的验收覆盖率，而不是源码行覆盖率。
- auto-e2e 不暴露公网服务，不定时访问 GitLab，也不执行 `git pull`、`git fetch` 或 `git reset`。
- GitLab Token、Cookie、OAuth 信息和 BetterWright 控制令牌不得进入仓库、配置、数据库或报告。

## 2. 推荐架构

使用服务于 auto-e2e 本机的专属 GitLab Runner。Runner 主动连接 GitLab 领取 CI Job，因此 GitLab 不需要访问本机地址，也不需要 webhook、端口映射或内网穿透。

推荐直接在宿主机安装 Runner 并使用 Shell executor。若 Runner 管理进程必须部署在 Docker 中，不能在 Runner 容器中用 Shell executor 直接调用宿主机 CLI；容器与宿主机属于不同的进程和文件系统命名空间。此时只能增加明确的远程执行边界，例如使用 SSH executor 连接回宿主机。不要通过 `privileged`、挂载 Docker Socket 或 `nsenter` 绕过这个边界。

```text
push master
    │
    ▼
GitLab 创建 Pipeline Job
    │
    ▼
本机 GitLab Runner 主动领取 Job
    │
    ├── checkout 本次 Pipeline 的准确 commit
    └── 在 $CI_PROJECT_DIR 调用 auto-e2e
            │
            ├── 执行 BetterWright 验收
            ├── 写入本机持久化历史
            ├── 导出本次 CI 报告
            └── 通过退出码设置 GitLab Job 状态

常驻 auto-e2e serve
    └── 读取同一本机持久化历史并展示所有运行
```

职责边界如下：

| 组件 | 职责 | 明确不负责 |
|---|---|---|
| GitLab | 根据 push 创建 Pipeline、展示 Job 与 Test Report、保存 CI artifacts | 直接访问本机 `serve` |
| GitLab Runner | 主动领取 Job、checkout commit、调用 auto-e2e、上传本次报告 | 解释验收结果 |
| `auto-e2e run` | 读取 Spec、执行验收、计算覆盖率、持久化结果、导出 CI 报告、返回退出码 | 拉取代码、管理 Pipeline |
| `auto-e2e serve` | 查询持久化历史、展示用例矩阵、覆盖率与 proof | GitLab webhook、Git 同步、CI 调度 |

## 3. GitLab Runner 策略

### 3.1 Runner 类型

在运行 auto-e2e 的本机注册项目专属 Runner：

- 使用 Shell executor，使 Job 能访问本机浏览器、目标内网和 BetterWright Profile。
- Runner 使用固定 tag，例如 `local-auto-e2e`，并关闭未标记 Job。
- Runner 锁定到目标项目，不与不可信仓库共享。
- `master` 应为 protected branch，Runner 也只服务 protected refs。
- Runner 全局并发设为 `1`；Job 同时使用 `resource_group`，避免浏览器 Profile、目标环境和 SQLite 被重叠运行竞争。
- Runner 与 `auto-e2e serve` 使用同一个本机用户，以共享 BetterWright Profile 和持久化目录权限。

macOS Runner 应以登录用户的 LaunchAgent 运行。用户退出登录后 Runner 不再可用；需要无人值守时，应保证该用户会话持续存在，并确认浏览器后端在非交互模式下可运行。

Shell executor 会以 Runner 用户权限执行仓库中的 CI 脚本，因此只有受信任的人员可以修改 `.gitlab-ci.yml`、Spec Bundle 和 master 分支内容。

### 3.2 Runner 管理进程使用 Docker（可选）

如果只想把 Runner 管理进程放进 Docker，而 auto-e2e、Node.js、BetterWright、浏览器 Profile 和工作目录仍位于宿主机，使用以下结构：

```text
GitLab
  │ HTTPS（Runner 主动轮询）
  ▼
GitLab Runner 容器
  │ SSH
  ▼
宿主机登录用户
  ├── checkout 到 ~/gitlab-builds/...
  ├── 调用宿主机 auto-e2e
  └── 复用宿主机 BetterWright Profile
```

这里 `executor` 必须是 `ssh`，不能是 `shell` 或 `docker`：

- `shell` 会在 Runner 容器内执行脚本，不是在宿主机执行。
- `docker` 会再创建 Job 容器，仍然不会执行宿主机进程。
- 把宿主机的 `auto-e2e` 文件挂载进容器，只是共享文件；实际进程仍在 Linux 容器中运行，并不能复用 macOS 浏览器和登录用户会话。

Runner 容器示例：

```yaml
# compose.yaml
services:
  gitlab-runner:
    # 使用与 GitLab 服务端兼容的固定版本，不要在生产环境使用 latest。
    image: gitlab/gitlab-runner:alpine-v19.3.1
    container_name: local-auto-e2e-runner
    restart: unless-stopped
    volumes:
      - ./config:/etc/gitlab-runner
      - ./ssh:/root/.ssh:ro
    extra_hosts:
      # Docker Desktop 已内置该名称；host-gateway 供 Linux Docker 使用。
      - host.docker.internal:host-gateway
```

Runner 注册后，把持久化目录中的 `config/config.toml` 调整为：

```toml
concurrent = 1
check_interval = 3
shutdown_timeout = 30

[[runners]]
  name = "local-auto-e2e"
  url = "https://gitlab.example.com"
  token = "glrt-REPLACE_ME"
  executor = "ssh"
  builds_dir = "/Users/autoe2e/gitlab-builds"
  environment = ["PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"]

  [runners.ssh]
    host = "host.docker.internal"
    port = "22"
    user = "autoe2e"
    identity_file = "/root/.ssh/id_ed25519"
    disable_strict_host_key_checking = false
```

部署时还必须完成以下宿主机准备：

1. 创建权限受限的 `autoe2e` 用户；在 macOS 上让该用户保持登录，并由该用户初始化 auto-e2e、BetterWright Profile 和 `serve`。
2. 仅允许 Runner 使用专用 SSH Key 登录该用户；私钥不得提交仓库，`./config` 和 `./ssh` 目录只允许管理员读取。
3. 在 Runner 容器使用的 `known_hosts` 中预置并核对宿主机 SSH Host Key，不要关闭严格校验。
4. 确保非交互 SSH 会话中的 `PATH` 能找到同一个 Node.js 和 `auto-e2e`；先从 Runner 容器执行 `ssh ... 'command -v node; command -v auto-e2e; auto-e2e --version'` 验证。
5. 在 GitLab 中把 Runner 锁定到单一受信任项目，设置 tag `local-auto-e2e`，关闭 untagged Job，并限制为 protected refs。

SSH executor 目前处于 GitLab 的维护模式，只支持 Bash 脚本且不支持 Runner cache。更关键的是，GitLab 官方要求在 SSH 目标宿主机提供 `gitlab-runner`，才能由 SSH executor 上传 Job artifacts。因此：

- 当前只依赖退出码和 stdout JSON 时，可以先使用上述结构。
- 实现本文的 JUnit/proof CI artifacts 后，宿主机还要安装与容器版本一致的 `gitlab-runner` 命令（不必在宿主机常驻运行服务）。
- 如果不能接受宿主机安装该 helper，应改回宿主机原生 Shell executor；不要用无特权边界的宿主机控制方案替代。

注册与启动示例：

先在 GitLab 项目的 **Settings > CI/CD > Runners** 创建 Project Runner，并在服务端设置 tag、protected、run untagged 和项目锁定策略；使用 `glrt-` 开头的 Runner authentication token 注册时，这些设置不能再通过注册命令覆盖。

```bash
docker compose up -d
docker compose exec gitlab-runner gitlab-runner register \
  --non-interactive \
  --url "https://gitlab.example.com" \
  --token "$GITLAB_RUNNER_TOKEN" \
  --executor "ssh" \
  --description "local-auto-e2e" \
  --ssh-host "host.docker.internal" \
  --ssh-port "22" \
  --ssh-user "autoe2e" \
  --ssh-identity-file "/root/.ssh/id_ed25519"
```

不要把 `$GITLAB_RUNNER_TOKEN` 写入 Compose 文件或仓库。注册成功后，Runner authentication token 会保存在挂载的 `config.toml` 中，应按凭据文件保护。

### 3.3 Pipeline 触发规则

仅处理 push 到 `master` 的 Pipeline，不处理 tag、Merge Request Pipeline、定时任务或手动 Pipeline：

```yaml
rules:
  - if: '$CI_COMMIT_BRANCH == "master" && $CI_PIPELINE_SOURCE == "push"'
```

如果 GitLab 项目的默认分支确定等于 `master`，也可以使用：

```yaml
rules:
  - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH && $CI_PIPELINE_SOURCE == "push"'
```

Runner 自己负责检出 `$CI_COMMIT_SHA`。auto-e2e 继续通过本地 `git rev-parse HEAD` 把实际 commit 写入验收结果，不另行更新工作树。

### 3.4 连续 push 策略

GitLab Pipeline 是任务队列的唯一权威来源，不在 auto-e2e 内再实现第二套 webhook 队列：

- 同一项目通过 `resource_group: local-auto-e2e` 串行执行。
- 默认保留 GitLab 已创建的每个 Pipeline，以保证每个实际执行结果都对应明确 commit。
- 如果团队只关心 master 最新状态，应在 GitLab 侧启用“新 Pipeline 到来时取消旧的可中断 Job”，并为 Job 设置 `interruptible: true`。
- auto-e2e 收到终止信号时应停止当前验收，保留已完成的诊断信息，但不得把取消误报为通过。

## 4. auto-e2e 需要新增的能力

### 4.1 独立于 checkout 的持久化存储

Runner 可能清理 `$CI_PROJECT_DIR`，因此 SQLite、报告和 proof 不能只保存在项目 checkout 下。新增环境变量：

```bash
AUTO_E2E_STORAGE_ROOT=/Users/runner/auto-e2e-data
```

启用后按项目隔离：

```text
$AUTO_E2E_STORAGE_ROOT/
└── <project-name>/
    ├── history.sqlite
    ├── reports/
    │   └── acceptance/
    │       ├── latest/result.json
    │       └── runs/<runId>/result.json
    └── artifacts/<runId>/
```

约束：

- `<project-name>` 来自通过校验的 `project.name`。
- 禁止空值、绝对路径片段、`..`、目录分隔符和路径穿越。
- 同一 `serve` 实例发现重复项目名指向不同工作区时必须报错，禁止混写。
- 路径优先级为：CLI 显式参数 > `AUTO_E2E_STORAGE_ROOT` > `.auto-e2e.yaml` 现有路径。
- 未设置环境变量时维持现有 `.auto-e2e/history.sqlite`、reports 和 artifacts 行为。
- Runner 与常驻 `serve` 必须配置相同的存储根目录。
- SQLite 继续使用事务；`serve` 查询不得阻塞 Runner 保存完整运行结果。

### 4.2 单次 CI 报告导出

扩展现有 `run` 命令，不增加新的公共命令：

```bash
auto-e2e --project-root "$CI_PROJECT_DIR" run \
  --ci-report-directory .auto-e2e-ci
```

输出目录：

```text
.auto-e2e-ci/
├── result.json
├── summary.json
├── junit.xml
└── artifacts/
```

- `result.json`：本次完整 `AcceptanceRun`，必须通过领域 Schema 校验。
- `summary.json`：commit、状态、数量统计与验收覆盖率。
- `junit.xml`：供 GitLab Test Report 展示。
- `artifacts/`：只复制本次结果实际引用的 proof，并在导出文件中使用相对路径。

验收失败或阻塞时，auto-e2e 必须先完成结果持久化和 CI 导出，再返回非零退出码。只有在尚未形成合法 `AcceptanceRun` 的工具级异常中，才允许没有完整报告。

`--json` 契约保持不变：stdout 只能包含最终 JSON，进度和诊断信息写入 stderr。CI 导出不向 stdout 混入额外文本。

### 4.3 JUnit 映射

- 每个 Spec Bundle 对应一个 `<testsuite>`。
- 每个结果断言或等价的原子验收项对应一个 `<testcase>`。
- `passed` 输出正常 testcase。
- `failed` 输出 `<failure>`，包含 expected、actual 和 difference。
- `blocked` 或执行错误输出 `<error>`，包含阻塞原因。
- proof 相对路径和业务步骤摘要写入 `<system-out>`。
- XML 必须正确转义；suite/test 数量必须与 `result.json` 一致。

GitLab Test Report 用来显示用例明细，不能把验收覆盖率伪装成源码 Cobertura 覆盖率。

### 4.4 serve 展示

`serve` 使用持久化存储中的历史数据，并增加以下展示：

- 历史列表：commit、用例通过数、验收项验证覆盖率。
- 运行详情：用例执行覆盖率、步骤执行覆盖率、断言验证覆盖率、通过率与阻塞数量。
- 逐用例状态、业务步骤、结果断言、实际观察、错误原因和 proof。
- 旧历史没有预计算覆盖率字段时，从现有结构动态计算，保持向后兼容。

`serve` 保持默认监听 `127.0.0.1`，不因 CI 集成扩大网络暴露范围。

## 5. 验收覆盖率契约

这里的覆盖率是需求验收覆盖率，不是源码行覆盖率、分支覆盖率或函数覆盖率。

`summary.json` 至少包含：

```json
{
  "schemaVersion": 1,
  "runId": "20260901T120000000Z-a1b2c3d4",
  "project": "my-web",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "status": "failed",
  "cases": {
    "declared": 10,
    "attempted": 10,
    "passed": 8,
    "failed": 1,
    "blocked": 1,
    "executionCoverage": 1.0,
    "passRate": 0.8
  },
  "steps": {
    "declared": 20,
    "executed": 18,
    "passed": 17,
    "failed": 1,
    "blocked": 1,
    "skipped": 1,
    "executionCoverage": 0.9
  },
  "assertions": {
    "declared": 30,
    "verified": 27,
    "passed": 25,
    "failed": 2,
    "blocked": 3,
    "verificationCoverage": 0.9,
    "passRate": 0.8333333333333334
  }
}
```

计算规则：

- 用例执行覆盖率：`attempted / declared`。
- 步骤执行覆盖率：非 `skipped` 步骤数 `/ declared`。
- 断言验证覆盖率：`(passed + failed) / declared`。
- 阻塞表示没有完成验证，不计入 `verified`，但必须计入声明总数。
- 通过率以声明总数为分母，避免跳过或阻塞抬高通过率。
- 分母为零时比例字段为 `null`，不得产生 `NaN` 或无穷值。
- JSON 保存原始数值，Web UI 再格式化为百分比。

## 6. GitLab CI 示例

当前 v0.3.0 可以先使用退出码和 Job 日志完成最小集成：

```yaml
stages:
  - acceptance

auto-e2e-acceptance:
  stage: acceptance
  tags:
    - local-auto-e2e
  resource_group: local-auto-e2e
  interruptible: true
  rules:
    - if: '$CI_COMMIT_BRANCH == "master" && $CI_PIPELINE_SOURCE == "push"'
  script:
    - command -v node
    - command -v auto-e2e
    - auto-e2e --project-root "$CI_PROJECT_DIR" --non-interactive --json doctor --project
    - auto-e2e --project-root "$CI_PROJECT_DIR" --non-interactive --json run
```

此版本的历史、报告和 proof 仍写在 checkout 内，Runner 清理工作目录后不能保证长期保留；长期历史和 GitLab artifacts 要等本方案第 4 节的能力实现后再启用。

以下示例使用待实现的 `--ci-report-directory`：

```yaml
stages:
  - acceptance

auto-e2e-acceptance:
  stage: acceptance
  tags:
    - local-auto-e2e
  resource_group: local-auto-e2e
  interruptible: true
  rules:
    - if: '$CI_COMMIT_BRANCH == "master" && $CI_PIPELINE_SOURCE == "push"'
  variables:
    AUTO_E2E_STORAGE_ROOT: "/Users/runner/auto-e2e-data"
  script:
    - auto-e2e --project-root "$CI_PROJECT_DIR" doctor --project --json
    - auto-e2e --project-root "$CI_PROJECT_DIR" run --ci-report-directory .auto-e2e-ci
  artifacts:
    when: always
    reports:
      junit: .auto-e2e-ci/junit.xml
    paths:
      - .auto-e2e-ci/
```

注意：如果 `doctor` 失败，GitLab 默认不会继续执行第二条 script，因此不会生成验收报告。若团队需要保存 doctor 诊断，应在 CI 包装脚本中单独保存 doctor JSON，同时保留原退出码；不得使用无条件忽略错误的写法把阻塞任务标为成功。

## 7. 退出码与 GitLab Job 状态

沿用现有退出码：

| 退出码 | auto-e2e 含义 | GitLab Job |
|---|---|---|
| `0` | 全部通过 | success |
| `1` | 存在验收失败 | failed |
| `2` | 环境、配置、登录或浏览器阻塞 | failed |
| `3` | 工具自身异常 | failed |

GitLab Job 成败只依据进程退出码。JUnit 和 `summary.json` 用于解释失败，不得反向覆盖退出码。

## 8. 凭据与 Profile

- BetterWright 登录状态继续由 Runner 用户的 `$BETTERWRIGHT_HOME/browser/profiles/<profile>` 管理。
- 需要扫码、MFA 或 Passkey 时，先由同一用户通过本地 `serve` 的手动登录完成 Profile 准备。
- CI Job 不传递 Cookie、密码、OAuth Token 或 Live View 控制令牌。
- GitLab CI 变量只保存确有必要的运行环境值；敏感变量必须 masked、protected，并且不得写入 auto-e2e 报告。
- proof 导出只能读取本次运行已授权的 artifact 目录，继续阻止符号链接和路径逃逸。

## 9. 实施顺序

1. 增加持久化存储根目录解析和项目隔离，保持旧路径兼容。
2. 增加验收覆盖率计算及稳定的 `summary.json` Schema。
3. 扩展 `run --ci-report-directory`，导出 JSON、JUnit 和本次 proof。
4. 在 `serve` 中展示覆盖率和长期历史。
5. 安装并加固本机 GitLab Runner，提交 `.gitlab-ci.yml`。
6. 使用 master 测试 push 验证 checkout commit、报告、退出码和历史闭环。

## 10. 测试要求

行为变更必须包含回归测试：

- 未配置存储根目录时维持现有相对路径行为。
- 存储根目录按项目隔离，拒绝路径穿越和项目名冲突。
- Runner checkout 被清理后，SQLite、报告和 proof 仍存在。
- 通过、失败、阻塞、取消和工具异常对应正确退出码。
- 失败或阻塞仍生成有效的 JSON、JUnit 和覆盖率摘要。
- JUnit 的 suite、test 和状态与结构化结果一致。
- 覆盖率在全部通过、部分失败、阻塞、跳过和零分母场景中计算正确。
- CI artifacts 只包含本次 proof，不包含凭据或控制令牌。
- 新旧历史均可由 `serve` 查询和展示。
- Runner 写入 SQLite 时，`serve` 并发读取稳定。
- `--json` stdout 纯 JSON 契约不回退。

完成代码变更后运行：

```bash
npm run typecheck
npm test
npm run build
```

## 11. 完成标准

方案完成后应满足：

1. push 到 `master` 后，只有本机专属 Runner 领取验收 Job。
2. Runner checkout 的 commit 与最终 `AcceptanceRun.commit` 一致。
3. GitLab Job 根据 auto-e2e 退出码得到正确状态。
4. GitLab Test Report 显示完整验收项状态，CI artifacts 可下载 JSON、覆盖率摘要和 proof。
5. 本地 `serve` 能持续查看跨 Pipeline 的全部历史、覆盖率和证据。
6. 整个流程不要求 GitLab 访问本机，不增加 webhook，也不由 auto-e2e 修改 Git 工作树。
