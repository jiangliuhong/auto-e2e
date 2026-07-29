/**
 * 测试生成器（plan §11, §16 阶段六）。
 *
 * 职责：
 * - 调用 PiClient.generateTest 生成 TypeScript 测试。
 * - 写入 .auto-e2e/generated/{taskId}/{taskId}.spec.ts。
 * - 用 tsc --noEmit 校验生成的 TypeScript，非法返回退出码 3。
 * - 写入 generation-meta.json 记录生成元信息。
 * - 安全校验：禁止写入敏感信息（密码/Cookie/Token 字面量）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import type { PiClient } from '../agent/pi-client.js';
import type { TaskSpec } from '../domain/task-spec.js';
import type { TestPlan } from '../domain/test-plan.js';
import type { ExploreResult } from '../domain/explore-result.js';
import { AutoE2EError } from '../runtime/exit-codes.js';
import type { Logger } from '../runtime/logger.js';

export interface GenerateTestOptions {
  projectRoot: string;
  /** 生成目录（相对项目根），默认 .auto-e2e/generated。 */
  generatedDirectory: string;
  client: PiClient;
  taskSpec: TaskSpec;
  testPlan: TestPlan;
  exploration: ExploreResult;
  preferTestId: boolean;
  overwrite: boolean;
  logger?: Logger;
  /** 注入的 tsc 校验函数（测试用）。 */
  validateTs?: (code: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface GeneratedArtifact {
  taskId: string;
  specPath: string;
  metaPath: string;
  notes: string[];
}

/**
 * 生成测试文件并校验。
 * 失败（生成内容非法 TS 或包含敏感信息）抛 GenerationFailed(3)。
 */
export async function generateTestFile(opts: GenerateTestOptions): Promise<GeneratedArtifact> {
  const { taskSpec } = opts;
  const gen = await opts.client.generateTest({
    taskSpec,
    testPlan: opts.testPlan,
    exploration: opts.exploration,
    preferTestId: opts.preferTestId,
  });

  // 安全校验：禁止敏感字面量。
  assertNoSecrets(gen.code);

  // TS 校验。
  const validate = opts.validateTs ?? defaultValidateTs;
  const check = await validate(gen.code);
  if (!check.ok) {
    throw new AutoE2EError(3, `生成的测试不是合法 TypeScript：${check.error ?? '未知错误'}`);
  }

  const taskDir = path.join(opts.projectRoot, opts.generatedDirectory, taskSpec.taskId);
  await fs.mkdir(taskDir, { recursive: true });
  const specPath = path.join(taskDir, `${taskSpec.taskId}.spec.ts`);

  // overwrite=false 且文件存在时报错。
  if (!opts.overwrite) {
    try {
      await fs.access(specPath);
      throw new AutoE2EError(3, `测试文件已存在且未启用覆盖：${specPath}`);
    } catch (err) {
      if (err instanceof AutoE2EError) throw err;
    }
  }

  await fs.writeFile(specPath, gen.code, 'utf8');

  const meta = {
    taskId: taskSpec.taskId,
    generatedAt: new Date().toISOString(),
    notes: gen.notes,
    specPath: path.relative(opts.projectRoot, specPath),
    testCount: opts.testPlan.testCases.length,
  };
  const metaPath = path.join(taskDir, 'generation-meta.json');
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  opts.logger?.info(`已生成测试：${specPath}`);
  return { taskId: taskSpec.taskId, specPath, metaPath, notes: gen.notes };
}

/** 默认 TS 校验：使用随 CLI 安装的 TypeScript 做离线语法检查。 */
async function defaultValidateTs(code: string): Promise<{ ok: boolean; error?: string }> {
  const result = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
    reportDiagnostics: true,
    fileName: 'generated.spec.ts',
  });
  const diagnostics = result.diagnostics?.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (diagnostics && diagnostics.length > 0) {
    return {
      ok: false,
      error: diagnostics
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        )
        .join('; '),
    };
  }
  return { ok: true };
}

const SECRET_PATTERNS = [
  /\bpassword\s*[:=]\s*['"][^'"]+['"]/i,
  /\bpasswd\s*[:=]\s*['"][^'"]+['"]/i,
  /\bsecret\s*[:=]\s*['"][^'"]+['"]/i,
  /\btoken\s*[:=]\s*['"][^'"]+['"]/i,
  /\bcookie\s*[:=]\s*['"][^'"]+['"]/i,
  /\bapiKey\s*[:=]\s*['"][^'"]+['"]/i,
];

function assertNoSecrets(code: string): void {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(code)) {
      throw new AutoE2EError(3, `生成的测试包含疑似敏感信息（匹配 ${pattern.source}），已拒绝写入`);
    }
  }
}
