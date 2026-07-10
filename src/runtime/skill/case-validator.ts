// case-validator:对 TestCaseCase(或原始 Markdown)做**确定性**校验。
// 纯函数,不调用 LLM、不做语义猜测;只检查必填段存在性与写操作声明一致性。
// 对齐 ARCHITECTURE.md「Runtime 不做推理」与你提的约束:
//   1) 必填段:Target / Preconditions / Steps / Assertions / Stability Notes
//   2) 写操作守门:Steps 含写入语义关键词时,必须显式声明
//      Write Operations(testData + cleanup + idempotent)

import type { RuntimeError } from '../../core/errors.js'
import { runtimeError } from '../../core/errors.js'
import { parseCaseContract, type CaseContractParseResult } from './case-contract.js'

/** 校验结果。 */
export interface CaseValidationResult {
  ok: boolean
  errors: RuntimeError[]
}

/** 写操作语义关键词(中英),命中即视为该用例含写操作。 */
const WRITE_OPERATION_KEYWORDS = [
  '创建',
  '修改',
  '删除',
  '提交',
  '保存',
  '新增',
  '编辑',
  '更新',
  'create',
  'update',
  'delete',
  'remove',
  'submit',
  'save',
  'edit',
  'modify',
]

/** 必填段名(校验用)。 */
const REQUIRED_SECTIONS: ReadonlyArray<{
  /** 段名(用于错误提示)。 */
  name: string
  /** 从解析结果中取对应数组的访问器。 */
  pick: (r: { preconditions: string[]; steps: string[]; assertions: string[] }) => string[]
  /** 该段是否结构化(而非列表);Target 走单独判定。 */
}> = [
  { name: 'Preconditions', pick: (r) => r.preconditions },
  { name: 'Steps', pick: (r) => r.steps },
  { name: 'Assertions', pick: (r) => r.assertions },
]

/**
 * 校验已解析的 TestCaseCase。
 */
export function validateParsedCase(
  parsed: Exclude<CaseContractParseResult, { errors: string[] }>,
): CaseValidationResult {
  const errors: RuntimeError[] = []

  // 1) Target 必填且至少有一个有效字段。
  if (parsed.target === undefined) {
    errors.push(
      runtimeError({
        code: 'case_section_missing',
        message: '## Target 段缺失或未解析出 route/module/type 字段。',
        recoverable: true,
        details: { section: 'Target' },
      }),
    )
  }

  // 2) 其余必填列表段非空。
  for (const sec of REQUIRED_SECTIONS) {
    const items = sec.pick(parsed)
    if (items.length === 0) {
      errors.push(
        runtimeError({
          code: 'case_section_missing',
          message: `## ${sec.name} 段缺失或为空。`,
          recoverable: true,
          details: { section: sec.name },
        }),
      )
    }
  }

  // 3) Stability Notes 必填。
  if (parsed.stabilityNotes.length === 0) {
    errors.push(
      runtimeError({
        code: 'case_section_missing',
        message: '## Stability Notes 段缺失或为空。',
        recoverable: true,
        details: { section: 'Stability Notes' },
      }),
    )
  }

  // 4) 写操作守门:Steps 含写入语义 → 必须声明 Write Operations(testData + cleanup)。
  const stepsText = parsed.steps.join(' ').toLowerCase()
  const hasWriteOp = WRITE_OPERATION_KEYWORDS.some((k) => stepsText.includes(k.toLowerCase()))
  if (hasWriteOp) {
    const ops = parsed.writeOperations
    if (ops === undefined) {
      errors.push(
        runtimeError({
          code: 'case_write_op_undeclared',
          message: '检测到写操作步骤,但缺少 ## Write Operations 段声明。',
          recoverable: true,
        }),
      )
    } else {
      if (!ops.testData || ops.testData.trim() === '') {
        errors.push(
          runtimeError({
            code: 'case_write_op_undeclared',
            message: '写操作缺少 testData 声明(测试数据来源/构造方式)。',
            recoverable: true,
          }),
        )
      }
      if (!ops.cleanup || ops.cleanup.trim() === '') {
        errors.push(
          runtimeError({
            code: 'case_write_op_undeclared',
            message: '写操作缺少 cleanup 声明(清理方式)。',
            recoverable: true,
          }),
        )
      }
      if (ops.idempotent === undefined) {
        errors.push(
          runtimeError({
            code: 'case_write_op_undeclared',
            message: '写操作缺少 idempotent 声明(是否幂等)。',
            recoverable: true,
          }),
        )
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

/**
 * 校验原始 Markdown 文本:先解析,再校验。解析失败时合并错误返回。
 */
export function validateCaseMarkdown(markdown: string): CaseValidationResult {
  const parsed = parseCaseContract(markdown)
  if ('errors' in parsed) {
    return {
      ok: false,
      errors: parsed.errors.map((msg) =>
        runtimeError({
          code: 'case_parse_failed',
          message: msg,
          recoverable: true,
        }),
      ),
    }
  }
  return validateParsedCase(parsed)
}
