# 核对文件与统计约定

这是 Skill 的审阅交换格式，不是 auto-e2e 运行器 Schema。运行器不会读取它。使用相对项目根目录的路径和可定位的行号或 JSON Pointer，不写凭据、会话数据或敏感业务样本。未知值用 `null`，不可读资料写入 `scope.limitations`。

## review.yaml

从 `../assets/review.yaml` 的空清单开始。顶层字段含义：

| 字段 | 内容 |
|---|---|
| `project` / `scannedAt` | 项目标识和本次实际扫描时间（ISO 8601） |
| `scope` | 范围描述、资料与 Spec 根目录、限制、清单摘要及人工确认记录 |
| `sources` | 资料登记：`id`、`kind`（requirement / implementation）、`path`、`digest` |
| `specs` | 用例登记：`path`、`taskId`、`format`（v2 / legacy）、`validation`（valid / invalid / unchecked）、`validationMethod`、`issues`、`files`、`digest` |
| `features` | 功能及验证点，结构见下文 |
| `changes` | 本次差异：`kind`（added / changed / missing / invalidated）、`targetId`、`reason` |

`specs.files` 记录 spec.json 及引用资源的项目相对路径和内容摘要。完整校验应覆盖当前格式的必需字段、唯一 ID、资源与断言引用、bundle 路径限制。通过项目已有的完整校验器才标记 `valid`；手工或局部检查用 `unchecked`，明确检查范围。已发现结构或引用错误用 `invalid`。不可读、无效、taskId 重复的 Spec 不计入候选或确认覆盖；unchecked 可以作为候选，但计入已确认前必须完成校验。

功能结构示例（实际输出替换为项目内容；示例不代表默认需求）：

```yaml
features:
  - id: REQ-ORDER-CREATE
    name: 创建订单
    module: 订单管理
    risk: high # low | medium | high | critical | unknown
    origin: requirement # requirement | implementation | inferred
    sources:
      - sourceId: product-orders
        locator: "lines:20-35"
    checkpoints:
      - id: success
        description: 合法输入创建订单后，重新打开详情仍能看到正确内容
        status: candidate
        rationale: 两个断言分别核对创建结果和重新打开后的订单内容
        gaps: []
        mappings:
          - specPath: .auto-e2e/specs/create-order/spec.json
            taskId: ORDER-CREATE-01
            assertions:
              - kind: result
                ref: RESULT-01
              - kind: result
                ref: RESULT-02
            rationale: 第一个断言检查创建状态，第二个检查持久化内容
        evidenceDigest: null
        confirmations: []
        notes: null
```

验证点 ID 在功能内唯一，功能 ID 在清单内唯一；全局键为 `featureId/checkpointId`。首次有需求 ID 时优先复用，后续不因标题变化重建 ID。`assertions.kind` 为 `result`、`legacy-criterion` 或 `legacy-output`，后两者的 `ref` 是 JSON Pointer。映射键包含 Spec 路径，不能仅靠局部断言 ID 匹配。没有映射时 `mappings: []`。

## 状态与人工确认

| status | 中文显示 | 含义 |
|---|---|---|
| candidate | 待确认覆盖 | 找到足够断言，待项目方核对 |
| partial | 部分覆盖 | 只验证部分行为，必须写 gaps |
| uncovered | 未找到覆盖 | 在已扫描范围中没有找到对应断言 |
| unknown | 无法判断 | 资料、断言或扫描信息不足 |
| confirmed | 已确认覆盖 | 项目方明确确认，且当前有效证据与确认摘要一致 |
| not-applicable | 不适用 | 项目方明确排除，必须提供原因 |
| needs-review | 需要复核 | 已确认覆盖或排除的依据发生变化，或记录不完整 |

功能范围的 `scope.status` 独立于验证点状态。确认范围不等于确认所有覆盖；确认部分验证点也不等于确认项目完整功能清单。

`scope.confirmations` 和验证点 `confirmations` 都是追加记录：

```yaml
confirmations:
  - decision: confirmed # confirmed | not-applicable
    by: 项目方
    at: null
    basisDigest: null
    reason: 项目方明确提供的核对意见
```

实际确认时，`basisDigest` 必须填当时的清单或验证点摘要；`by` 可以是用户提供的名字或实际对话中的“项目方”，不得推断身份。`at` 填已知实际确认时间，手工记录时间未知可用 null。范围只接受 confirmed 决策，排除具体行为使用验证点的 not-applicable。明确的对话反馈可以直接更新对应记录，无需再请用户重复确认。

项目方手工修改时应在该验证点下追加确认记录，将当前 `evidenceDigest` 复制到 `basisDigest`，并修改 status；范围确认使用 `inventoryDigest`。只改 status、缺少匹配确认摘要的，保留输入并标为 needs-review。取消或修订确认时保留旧记录，在 notes 和 changes 中解释，不覆盖历史意见。

## 摘要与增量复核

用 SHA-256 计算摘要，格式为 `sha256:<64 位小写十六进制>`，必须实际计算，不能生成看似真实的摘要。JSON 摘要统一使用对象键递归排序、数组按稳定键排序后的紧凑 UTF-8 JSON；文件内容摘要直接使用原始字节。

- `sources.digest`：来源文件内容摘要。整文件摘要可以保守地触发复核。
- `specs.digest`：按项目相对路径排序后的 `files`（路径、内容摘要）数组的 JSON 摘要。覆盖 spec 和全部引用资源；这是审阅摘要，不冒充运行器的 `specDigest`。
- 验证点 `evidenceDigest`：功能 ID、名称、origin、验证点 ID 与描述、关联来源的路径和摘要、映射中的 Spec 路径和摘要及断言引用的 JSON 摘要。不包含扫描时间、行号、状态、备注和确认记录。来源或映射不可读时设为 null 并说明原因，不能复用旧摘要冒充当前值。
- `scope.inventoryDigest`：范围描述、sourceRoots、specRoots、limitations，以及按 ID 排序的功能与验证点定义（含 origin、风险和来源内容摘要）的 JSON 摘要。不包含确认状态、映射和扫描时间。新增、删除功能或扫描不完整都会使旧范围确认失效。

重新扫描时：

1. 依据稳定 ID 合并候选，保留 notes、confirmations 和项目方补充的验证点。定义完全相同的重复候选可合并，但不能丢失确认记录。
2. 摘要匹配、校验有效且确认记录齐全，才能保留 confirmed；仍符合排除记录时保留 not-applicable。否则改为 needs-review 并记录变化原因。
3. 文件或断言删除、资源变化、实现与需求变化都触发相关项复核。不能因为文件消失就删掉验证点或缩小分母；保留条目并标记 missing。
4. 项目方明确确认不适用后才能排除验证点。范围变更涉及分母时，同时要求新的范围确认。旧确认仍保留作历史依据。
5. 无历史基线时不报告“无新增缺口”，应报告“首次盘点”。

## 确定统计口径

统计的是验证点，不是映射、Spec 或断言数量；多个映射最多贡献一个验证点。部分覆盖不折算为半个，不平均猜测权重。

设 D 为范围内全部验证点数减去有有效人工依据的 not-applicable 数。needs-review、unknown、uncovered、partial 都保留在分母。只有 Spec、没有独立功能来源时，全项目 D 未知，比例为 N/A。

- 候选覆盖率：`(candidate + confirmed) / D`。其中映射必须完整、引用可解析且 Spec 没有已发现的错误；unchecked 数量另外披露。
- 已确认覆盖率：`confirmed / D`。确认必须匹配当前摘要，关联 Spec 必须 valid。
- 功能涉及率：至少一个验证点为 candidate 或 confirmed 的功能数 / 有适用验证点的功能数。
- 功能完整确认率：全部适用验证点均 confirmed 的功能数 / 有适用验证点的功能数。

候选数包含已确认数，两者不可相加。空清单或全部排除时比例为 N/A；显示排除数量和理由。范围未确认或需复核时，上述比例都标为“暂估，功能范围待核对”，并列出扫描限制。不读取历史 passed 来替代静态映射确认，不把这些比例称为执行通过率。

例如：5 个验证点，1 个 candidate、1 个 confirmed、1 个 partial、1 个 uncovered、1 个经确认的 not-applicable，则 D=4，候选覆盖率 2/4=50%，已确认覆盖率 1/4=25%。confirmed 的 Spec 变化后，该项转 needs-review；新报告候选覆盖率 1/4=25%，已确认覆盖率 0/4=0%，旧确认记录保留。
