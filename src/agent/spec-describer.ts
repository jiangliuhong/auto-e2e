/**
 * task-spec.json 规范描述器：从 TaskSpecSchema（Zod）运行时反射生成结构化字段规范。
 *
 * 设计目的：让 CLI（`auto-e2e spec schema`）能把权威规范输出给 Codex 等调用方，
 * 避免规范散落在静态文档里与代码脱节。
 *
 * 反射来源：字段名 / 类型 / 是否必填 全部由 TaskSpecSchema 决定；
 * 唯一手维护的是 description（业务语义，Zod 无法反射）。
 */
import { TaskSpecSchema } from '../domain/task-spec.js';

/** 与 verify / generate 的 --spec 默认值保持一致。 */
const DEFAULT_SPEC_PATH = '.auto-e2e/task-spec.json';

/** 单个字段的规范描述。 */
export interface SpecField {
  name: string;
  type: 'string' | 'string[]';
  required: boolean;
  description: string;
}

/** task-spec.json 的完整规范描述。 */
export interface SpecDescription {
  /** 文件名约定。 */
  file: string;
  /** 文件格式。 */
  format: 'json';
  /** verify / generate 未传 --spec 时读取的默认路径。 */
  defaultPath: string;
  /** 字段清单（顺序与 TaskSpecSchema 一致）。 */
  fields: SpecField[];
}

/**
 * Zod 内部结构的最小类型断言。
 * _def 不在 Zod 的公开类型上，但 typeName / innerType 在 v3 稳定可用。
 */
interface ZodDef {
  typeName: string;
  innerType?: { _def: ZodDef };
}
interface ZodLike {
  isOptional: () => boolean;
  _def: ZodDef;
}

/** 业务语义说明：字段名 → 人类可读描述。这是唯一需要手维护的部分。 */
const FIELD_DESCRIPTIONS: Record<string, string> = {
  taskId: '任务唯一标识，用于命名生成目录与报告',
  title: '任务标题，一句话概括本次变更',
  requirement: '原始需求描述',
  acceptanceCriteria: '验收标准数组；非空，空数组触发退出码 4',
  changedFiles: '本次变更涉及的文件路径列表',
  changedRoutes: '受影响的页面路由列表（如 /users）',
  changedApis: '受影响的接口列表（如 PUT /api/users/:id）',
  riskHints: '风险提示，用于生成反向用例',
  startCommand: '被测应用的启动命令（如 npm run dev）',
  baseUrl: '被测应用的根地址（合法 URL，如 http://127.0.0.1:3000）',
};

/** 判断一个（可能被 ZodOptional 包裹的）字段是否为数组类型。 */
function isArrayField(field: ZodLike): boolean {
  const def = field._def;
  // 解包 ZodOptional，拿到内层类型。
  const inner = def.typeName === 'ZodOptional' ? def.innerType?._def : def;
  return inner?.typeName === 'ZodArray';
}

/**
 * 从 TaskSpecSchema 反射出结构化规范。
 * schema 变更后（增删字段、改 optional）输出自动跟随，无需手动同步。
 */
export function describeTaskSpec(): SpecDescription {
  // TaskSpecSchema.shape 是 ZodObject 的公开 getter，返回字段名 → Zod 类型映射。
  const shape = TaskSpecSchema.shape as Record<string, ZodLike>;

  const fields: SpecField[] = Object.entries(shape).map(([name, field]) => ({
    name,
    type: isArrayField(field) ? 'string[]' : 'string',
    required: !field.isOptional(),
    description: FIELD_DESCRIPTIONS[name] ?? '',
  }));

  return {
    file: 'task-spec.json',
    format: 'json',
    defaultPath: DEFAULT_SPEC_PATH,
    fields,
  };
}
