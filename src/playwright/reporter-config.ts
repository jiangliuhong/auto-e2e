/**
 * Playwright reporter 与 run 选项构造（plan §13）。
 *
 * 新版 @playwright/test CLI 只接受 `--trace`，不再接受 `--screenshot` / `--video`
 * （这两个属于 use 选项，只能通过 config 文件设置）。因此增量模式下 auto-e2e
 * 生成一个临时 `playwright.config.ts`，把 use:{trace,screenshot,video} 与 reporter
 * 都放进去，用 `--config` 执行；全量模式尊重项目原有配置，仅通过 CLI 追加 reporter。
 */

export interface ReporterConfigOptions {
  /** JSON 结果输出文件（绝对路径）。 */
  jsonReportPath: string;
  /** JUnit 输出文件（绝对路径）。 */
  junitReportPath: string;
  /** HTML 报告输出目录（绝对路径）。 */
  htmlReportDir: string;
  formats: Array<'console' | 'json' | 'html' | 'junit'>;
  retries: number;
  workers: number;
  trace: string;
  screenshot: string;
  video: string;
}

/** 构造 --reporter 参数数组（供全量模式 CLI 追加）。 */
export function buildReporterArgs(opts: ReporterConfigOptions): string[] {
  const reporters: string[] = [];
  for (const fmt of opts.formats) {
    switch (fmt) {
      case 'console':
        reporters.push('line');
        break;
      case 'json':
        reporters.push(`json=${opts.jsonReportPath}`);
        break;
      case 'html':
        reporters.push(`html=${opts.htmlReportDir}`);
        break;
      case 'junit':
        reporters.push(`junit=${opts.junitReportPath}`);
        break;
    }
  }
  return reporters.flatMap((r) => ['--reporter', r]);
}

/**
 * 构造全量模式下传给 `playwright test` 的 CLI 参数。
 * 全量模式尊重项目原有 playwright.config.ts，因此只通过 CLI 追加 reporter、
 * retries、workers；trace 保留为合法 CLI 选项。screenshot/video 不在 CLI 传递
 * （由项目 config 控制）。
 */
export function buildPlaywrightArgs(
  opts: ReporterConfigOptions,
  extra: { testFiles?: string[] } = {},
): string[] {
  const args: string[] = [];
  args.push(...buildReporterArgs(opts));
  args.push('--retries', String(opts.retries));
  args.push('--workers', String(opts.workers));
  args.push('--trace', opts.trace);
  if (extra.testFiles && extra.testFiles.length > 0) {
    args.push(...extra.testFiles);
  }
  return args;
}

/**
 * 构造增量模式临时 playwright.config.ts 的内容。
 * 把 use:{trace,screenshot,video} 与所有 reporter 都放进来，确保：
 * - screenshot/video 恢复生效（新版 CLI 不再接受这两个选项）；
 * - HTML/JSON/JUnit reporter 必然产出（解决 V-7.3）。
 *
 * 返回的字符串需写入临时文件后用 `playwright test --config <file>` 执行。
 *
 * @param projectRoot 目标项目根目录（绝对路径），作为 testDir，让生成的测试能被发现。
 * @param baseURL 目标应用基础 URL，写入 use.baseURL，让测试里的相对路径 page.goto 生效。
 * @param mode incremental=只跑指定文件；full=跑项目全部 *.spec.ts（宽泛 testMatch）。
 */
export function buildTempConfig(
  opts: ReporterConfigOptions,
  projectRoot: string,
  baseURL?: string,
  mode: 'incremental' | 'full' = 'incremental',
  baseConfigPath?: string,
  storageStatePath?: string,
  channel?: string,
): string {
  const reporterEntries = opts.formats
    .map((fmt) => {
      switch (fmt) {
        case 'console':
          return `    ['line']`;
        case 'json':
          return `    ['json', { outputFile: ${JSON.stringify(opts.jsonReportPath)} }]`;
        case 'html':
          return `    ['html', { outputFolder: ${JSON.stringify(opts.htmlReportDir)}, open: 'never' }]`;
        case 'junit':
          return `    ['junit', { outputFile: ${JSON.stringify(opts.junitReportPath)} }]`;
      }
    })
    .join(',\n');

  // 没有项目配置时，full 模式使用宽泛匹配作为回退。
  const testMatchLine =
    mode === 'full' && !baseConfigPath
      ? `  testMatch: ${JSON.stringify('**/*.{spec,test}.{js,ts,mjs,cjs,mts,cts,jsx,tsx}')},\n`
      : '';

  const testDirLine = baseConfigPath ? '' : `  testDir: ${JSON.stringify(projectRoot)},\n`;
  const inheritedUseLine = baseConfigPath ? '    ...(baseConfig.use ?? {}),\n' : '';
  const channelLine = channel && channel !== 'chromium' ? `    channel: ${JSON.stringify(channel)},\n` : '';
  const body = `${testDirLine}
${testMatchLine}  retries: ${opts.retries},
  workers: ${opts.workers},
  reporter: [
${reporterEntries}
  ],
  use: {
${inheritedUseLine}${channelLine}    ${baseURL ? `baseURL: ${JSON.stringify(baseURL)},` : ''}
    ${storageStatePath ? `storageState: ${JSON.stringify(storageStatePath)},` : ''}
    trace: ${JSON.stringify(opts.trace)},
    screenshot: ${JSON.stringify(opts.screenshot)},
    video: ${JSON.stringify(opts.video)},
  },`;

  const baseImport = baseConfigPath
    ? `import baseConfig from ${JSON.stringify(baseConfigPath)};\n`
    : '';
  const baseSpread = baseConfigPath ? '  ...baseConfig,\n' : '';

  return `import { defineConfig } from '@playwright/test';
${baseImport}

/**
 * auto-e2e 生成的临时 Playwright 配置。
 * 自动生成，请勿手动编辑；执行结束后可删除。
 */
export default defineConfig({
${baseSpread}
${body}
});
`;
}
