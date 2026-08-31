import { z } from 'zod';

const IdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const TaskFileInputSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().min(1).optional(),
}).strict();

export const TaskExpectedOutputSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  expected: z.union([z.string(), z.number().finite(), z.boolean()]),
  match: z.enum(['equals', 'contains', 'numeric']).optional(),
  tolerance: z.number().finite().nonnegative().optional(),
}).strict().superRefine((output, context) => {
  if (output.match === 'contains' && typeof output.expected !== 'string') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expected'],
      message: 'contains 匹配的 expected 必须是字符串',
    });
  }
  if ((output.match === 'numeric' || output.tolerance !== undefined) &&
      typeof output.expected !== 'number') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expected'],
      message: 'numeric 匹配或 tolerance 的 expected 必须是数字',
    });
  }
  if (output.tolerance !== undefined && output.match !== undefined && output.match !== 'numeric') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tolerance'],
      message: 'tolerance 只能用于 numeric 匹配',
    });
  }
});

export const LegacyTaskSpecSchema = z.object({
  schemaVersion: z.undefined().optional(),
  taskId: z.string().min(1).optional(),
  title: z.string().min(1),
  requirement: z.string().min(1),
  inputs: z.array(TaskFileInputSchema).min(1).optional(),
  outputs: z.array(TaskExpectedOutputSchema).min(1).optional(),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
}).strict();

export const TaskResourceSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).optional(),
  role: z.enum(['input', 'expected', 'reference']),
  path: z.string().min(1),
}).strict();

export const TaskStepSchema = z.object({
  id: z.string().regex(/^STEP-\d{2,}$/),
  instruction: z.string().min(1),
  uses: z.array(IdSchema).min(1).optional(),
  expected: z.string().min(1),
}).strict();

const ExpectedFileSchema = z.object({
  file: IdSchema,
  sheet: z.string().min(1).optional(),
}).strict();

export const TaskResultOptionsSchema = z.object({
  keyColumns: z.array(z.string().min(1)).min(1).optional(),
  compareColumns: z.array(z.string().min(1)).min(1).optional(),
  ignoreRowOrder: z.boolean().optional(),
  allowExtraRows: z.boolean().optional(),
  allowMissingRows: z.boolean().optional(),
  numericTolerance: z.number().finite().nonnegative().optional(),
  trim: z.boolean().optional(),
}).strict();

export const TaskResultSchema = z.object({
  id: z.string().regex(/^RESULT-\d{2,}$/),
  name: z.string().min(1),
  actual: z.string().min(1),
  expected: z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    ExpectedFileSchema,
  ]),
  match: z.enum(['equals', 'contains', 'numeric', 'visual', 'table', 'file']),
  options: TaskResultOptionsSchema.optional(),
}).strict().superRefine((result, context) => {
  if (result.match === 'contains' && typeof result.expected !== 'string') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expected'], message: 'contains 的 expected 必须是字符串' });
  }
  if (result.match === 'numeric' && typeof result.expected !== 'number') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expected'], message: 'numeric 的 expected 必须是数字' });
  }
  if (result.match === 'equals' && typeof result.expected === 'object') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expected'], message: 'equals 的 expected 必须是字符串、数字或布尔值' });
  }
  if ((result.match === 'table' || result.match === 'file') &&
      (typeof result.expected !== 'object' || result.expected === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expected'], message: `${result.match} 的 expected 必须引用 expected 文件` });
  }
  if (result.options?.numericTolerance !== undefined && result.match !== 'numeric' && result.match !== 'table') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options', 'numericTolerance'], message: 'numericTolerance 只能用于 numeric 或 table' });
  }
});

const BundleTaskSpecObjectSchema = z.object({
  schemaVersion: z.literal(2),
  taskId: IdSchema,
  title: z.string().min(1),
  requirement: z.string().min(1),
  requirementIds: z.array(IdSchema).min(1).optional(),
  tags: z.array(IdSchema).min(1).optional(),
  risk: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  files: z.array(TaskResourceSchema).min(1).optional(),
  steps: z.array(TaskStepSchema).min(1),
  results: z.array(TaskResultSchema).min(1),
}).strict();

function validateBundleSpec(
  spec: z.infer<typeof BundleTaskSpecObjectSchema>,
  context: z.RefinementCtx,
): void {
  checkUnique(spec.files ?? [], 'id', ['files'], context);
  checkUnique(spec.steps, 'id', ['steps'], context);
  checkUnique(spec.results, 'id', ['results'], context);

  const files = new Map((spec.files ?? []).map((file) => [file.id, file]));
  const used = new Set<string>();
  spec.steps.forEach((step, stepIndex) => {
    for (const id of step.uses ?? []) {
      const file = files.get(id);
      if (!file) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', stepIndex, 'uses'], message: `引用了不存在的文件：${id}` });
      } else if (file.role === 'expected') {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', stepIndex, 'uses'], message: `步骤不能使用 expected 文件：${id}` });
      }
      used.add(id);
    }
  });
  spec.results.forEach((result, resultIndex) => {
    if (typeof result.expected !== 'object' || result.expected === null) return;
    const file = files.get(result.expected.file);
    if (!file) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['results', resultIndex, 'expected', 'file'], message: `引用了不存在的文件：${result.expected.file}` });
    } else if (file.role !== 'expected') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['results', resultIndex, 'expected', 'file'], message: `结果必须引用 expected 文件：${result.expected.file}` });
    }
    used.add(result.expected.file);
  });
  (spec.files ?? []).forEach((file, fileIndex) => {
    if (!used.has(file.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['files', fileIndex], message: `文件未被任何步骤或结果使用：${file.id}` });
    }
  });
}

export const BundleTaskSpecSchema = BundleTaskSpecObjectSchema.superRefine(validateBundleSpec);

export const TaskSpecSchema = z.union([BundleTaskSpecSchema, LegacyTaskSpecSchema]);

export type TaskFileInput = z.infer<typeof TaskFileInputSchema>;
export type TaskExpectedOutput = z.infer<typeof TaskExpectedOutputSchema>;
export type LegacyTaskSpec = z.infer<typeof LegacyTaskSpecSchema>;
export type TaskResource = z.infer<typeof TaskResourceSchema>;
export type TaskStep = z.infer<typeof TaskStepSchema>;
export type TaskResult = z.infer<typeof TaskResultSchema>;
export type BundleTaskSpec = z.infer<typeof BundleTaskSpecSchema>;

export type TaskSpec = z.infer<typeof TaskSpecSchema>;

export const ACCEPTANCE_SPEC_DIRECTORY = '.auto-e2e/specs';
export const ACCEPTANCE_SPEC_SUFFIX = '.spec.json';
export const ACCEPTANCE_BUNDLE_FILENAME = 'spec.json';

export function isAcceptanceSpecFileName(fileName: string): boolean {
  return fileName === ACCEPTANCE_BUNDLE_FILENAME ||
    /^[A-Za-z0-9][A-Za-z0-9._-]*\.spec\.json$/.test(fileName);
}

export function isBundleTaskSpec(spec: TaskSpec): spec is BundleTaskSpec {
  return 'schemaVersion' in spec && spec.schemaVersion === 2;
}

export function validateTaskSpec(raw: unknown): {
  success: boolean;
  spec?: TaskSpec;
  errors: string[];
} {
  const parsed = isVersionTwo(raw)
    ? BundleTaskSpecSchema.safeParse(raw)
    : LegacyTaskSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };
  }
  return { success: true, spec: parsed.data, errors: [] };
}

function isVersionTwo(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null &&
    'schemaVersion' in raw && (raw as { schemaVersion?: unknown }).schemaVersion === 2;
}

function checkUnique<T extends Record<K, string>, K extends keyof T>(
  items: T[],
  key: K,
  pathPrefix: Array<string | number>,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const value = item[key];
    if (seen.has(value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [...pathPrefix, index, String(key)], message: `ID 重复：${value}` });
    }
    seen.add(value);
  });
}
