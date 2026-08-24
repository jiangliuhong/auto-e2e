/**
 * Playwright 测试执行器（plan §12, §13）。
 *
 * 两种执行模式都写临时 playwright.config.ts（把 reporter 与 use 选项放进去），
 * 确保不再依赖已废弃的 --screenshot/--video CLI 选项，且 HTML/JSON/JUnit reporter 必然产出：
 * - incremental（默认，verify 用）：临时 config 完整设置 testDir/use/retries，执行指定测试文件。
 * - full（run --all 用）：临时 config 用宽泛 testMatch（匹配所有 .spec.ts）跑项目全部测试。
 *
 * 退出码非 0 不视为异常（测试失败是正常结果），只把结果交给 result-parser。
 * 但若实际未执行任何用例（total===0），视为 Playwright 异常返回 exit 8，绝不误判为通过。
 * 命令本身崩溃（spawn 错误）抛 PlaywrightError(8)。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AutoE2EError } from '../runtime/exit-codes.js';
import { buildTempConfig, type ReporterConfigOptions } from './reporter-config.js';
import type { PlaywrightJsonReport } from './result-parser.js';
import { parsePlaywrightJson } from './result-parser.js';
import type { Logger } from '../runtime/logger.js';

export interface RunPlaywrightOptions {
  projectRoot: string;
  reporter: ReporterConfigOptions;
  /** 执行模式：incremental 用临时 config；full 尊重项目 config。默认 incremental。 */
  mode?: 'incremental' | 'full';
  /** 要执行的测试文件（绝对路径数组）；为空执行全部。仅 incremental 模式生效。 */
  testFiles?: string[];
  /** 目标应用基础 URL，写入临时 config 的 use.baseURL。仅 incremental 模式生效。 */
  baseURL?: string;
  /** 浏览器通道（如 'chrome' / 'msedge' / 'chromium'）。 */
  channel?: string;
  /** 业务认证开启时注入的 Playwright storageState 文件。 */
  storageStatePath?: string;
  /** 项目原有 Playwright 配置。full 模式会继承它。 */
  configFile?: string;
  /** 注入的 spawn（测试用）。 */
  spawnImpl?: typeof spawn;
  logger?: Logger;
  /** 机器可读模式下把 Playwright 的 stdout 转发到 stderr，避免污染 JSON stdout。 */
  machineReadable?: boolean;
}

export interface PlaywrightRunOutcome {
  /** 进程退出码：0=全部通过，1=有失败，其他=异常。 */
  exitCode: number;
  /** 解析后的 JSON 报告（若 JSON reporter 写入了文件）。 */
  report: PlaywrightJsonReport | undefined;
  /** 解析后的统计摘要。 */
  summary: { total: number; passed: number; failed: number; skipped: number; durationMs: number };
}

export async function runPlaywright(opts: RunPlaywrightOptions): Promise<PlaywrightRunOutcome> {
  const mode = opts.mode ?? 'incremental';
  const spawnFn = opts.spawnImpl ?? spawn;

  // 确保 JSON 报告目录存在。
  await fs.mkdir(path.dirname(opts.reporter.jsonReportPath), { recursive: true });
  // latest 目录会被复用；必须先删除旧 JSON，避免本次启动/编译失败时读取上次结果。
  await fs.unlink(opts.reporter.jsonReportPath).catch(() => undefined);

  let args: string[];
  let tempConfigPath: string | undefined;

  // 两种模式都写临时 config（把 reporter 与 use 选项放进去），确保：
  // - 不再依赖已废弃的 --screenshot/--video CLI 选项；
  // - HTML/JSON/JUnit reporter 必然产出。
  // 区别：full 模式用宽泛 testMatch 跑项目全部 *.spec.ts；incremental 模式跑指定文件。
  const baseConfigPath =
    mode === 'full' ? await existingConfigPath(opts) : undefined;
  // 配置写在原配置同目录（或项目根），保证 testDir/globalSetup 等相对路径语义不变。
  // 文件名带进程和时间戳，避免并行运行互相覆盖。
  const tempConfigDir = baseConfigPath
    ? path.dirname(baseConfigPath)
    : opts.projectRoot;
  tempConfigPath = path.join(
    tempConfigDir,
    `.auto-e2e.playwright.${process.pid}.${Date.now()}.config.ts`,
  );
  const configContent = buildTempConfig(
    opts.reporter,
    opts.projectRoot,
    mode === 'incremental' ? opts.baseURL : undefined,
    mode,
    baseConfigPath,
    opts.storageStatePath,
    opts.channel,
  );
  await fs.writeFile(tempConfigPath, configContent, 'utf8');
  args = ['--config', tempConfigPath];
  if (mode === 'incremental' && opts.testFiles && opts.testFiles.length > 0) {
    args.push(...opts.testFiles);
  }

  opts.logger?.info(`执行: npx playwright test ${args.join(' ')}`);

  try {
    return await new Promise<PlaywrightRunOutcome>((resolve, reject) => {
      let settled = false;
      const child = spawnFn('npx', ['playwright', 'test', ...args], {
        cwd: opts.projectRoot,
        shell: false,
        stdio: opts.machineReadable
          ? ['ignore', process.stderr, process.stderr]
          : 'inherit',
      });

      child.on('error', (err: Error) => {
        if (settled) return;
        settled = true;
        reject(new AutoE2EError(8, `执行 playwright 失败：${err.message}`));
      });

      child.on('close', async (code: number | null) => {
        if (settled) return;
        const exitCode = code ?? 0;
        // 读取 JSON 报告。
        let report: PlaywrightJsonReport | undefined;
        try {
          const content = await fs.readFile(opts.reporter.jsonReportPath, 'utf8');
          report = JSON.parse(content) as PlaywrightJsonReport;
        } catch {
          report = undefined;
        }

        const summary = report
          ? parsePlaywrightJson(report).summary
          : { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };

        // V-7.2 防御：实际未执行任何用例时，视为 Playwright 异常，绝不误判为通过。
        // （exitCode 非 0 且 total===0 通常是 CLI 选项错误或编译失败。）
        if (summary.total === 0) {
          settled = true;
          resolve({
            exitCode: 8,
            report,
            summary,
          });
          return;
        }

        settled = true;
        resolve({ exitCode, report, summary });
      });
    });
  } finally {
    // 清理临时 config。
    if (tempConfigPath) {
      await fs.unlink(tempConfigPath).catch(() => undefined);
    }
  }
}

async function existingConfigPath(opts: RunPlaywrightOptions): Promise<string | undefined> {
  const candidate = path.resolve(
    opts.projectRoot,
    opts.configFile ?? 'playwright.config.ts',
  );
  return fs
    .access(candidate)
    .then(() => candidate)
    .catch(() => undefined);
}
