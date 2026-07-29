import { describe, it, expect } from 'vitest';
import {
  buildPlaywrightArgs,
  buildTempConfig,
  buildReporterArgs,
  type ReporterConfigOptions,
} from '../../src/playwright/reporter-config.js';

const baseOpts: ReporterConfigOptions = {
  jsonReportPath: '/r/latest/playwright.json',
  junitReportPath: '/r/latest/junit.xml',
  htmlReportDir: '/r/latest/html',
  formats: ['console', 'json', 'html', 'junit'],
  retries: 1,
  workers: 1,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
};

describe('reporter-config', () => {
  it('buildReporterArgs 为每种格式生成 --reporter 对', () => {
    const args = buildReporterArgs(baseOpts);
    expect(args).toContain('--reporter');
    expect(args).toContain('line');
    expect(args).toContain(`json=${baseOpts.jsonReportPath}`);
    expect(args).toContain(`html=${baseOpts.htmlReportDir}`);
    expect(args).toContain(`junit=${baseOpts.junitReportPath}`);
  });

  it('buildPlaywrightArgs 不再包含非法的 --screenshot / --video（V-7.1）', () => {
    const args = buildPlaywrightArgs(baseOpts);
    // 修复后只保留 --trace 作为合法 CLI 选项；--screenshot / --video 已移除。
    expect(args.some((a) => a.startsWith('--screenshot'))).toBe(false);
    expect(args.some((a) => a.startsWith('--video'))).toBe(false);
    // --trace 仍保留（合法 CLI 选项，全量模式使用）。
    expect(args).toContain('--trace');
    expect(args).toContain('retain-on-failure');
    // retries / workers 仍在。
    expect(args).toContain('--retries');
    expect(args).toContain('--workers');
  });

  it('buildPlaywrightArgs 追加测试文件', () => {
    const args = buildPlaywrightArgs(baseOpts, { testFiles: ['/abs/a.spec.ts'] });
    expect(args).toContain('/abs/a.spec.ts');
  });

  it('buildTempConfig 含 use.{baseURL,trace,screenshot,video} 与 reporter（V-7.1/V-7.3）', () => {
    const code = buildTempConfig(baseOpts, '/project', 'http://127.0.0.1:3000');
    // use 选项放进 config，让 screenshot/video 恢复生效（JSON.stringify 用双引号）。
    expect(code).toContain('baseURL: "http://127.0.0.1:3000"');
    expect(code).toContain('trace: "retain-on-failure"');
    expect(code).toContain('screenshot: "only-on-failure"');
    expect(code).toContain('video: "retain-on-failure"');
    // reporter 写进 config，让 HTML/JSON/JUnit 必然产出。
    expect(code).toContain("['json'");
    expect(code).toContain(baseOpts.jsonReportPath);
    expect(code).toContain("['html'");
    expect(code).toContain("['junit'");
    expect(code).toContain(baseOpts.junitReportPath);
    // retries / workers 也在 config 里。
    expect(code).toContain('retries: 1');
    expect(code).toContain('workers: 1');
    // testDir 指向目标项目根，让生成的测试能被发现。
    expect(code).toContain('testDir:');
    expect(code).toContain('/project');
    // incremental 模式不设 testMatch（由 runner 通过 CLI 指定文件）。
    expect(code).not.toContain('testMatch:');
    // 必须是合法的 defineConfig 结构。
    expect(code).toContain('defineConfig');
  });

  it('buildTempConfig full 模式设置宽泛 testMatch（V-7.1 全量执行）', () => {
    const code = buildTempConfig(baseOpts, '/project', undefined, 'full');
    expect(code).toContain('testMatch:');
    expect(code).toContain('**/*.{spec,test}');
    // full 模式不设 baseURL（由项目测试自身管理）。
    expect(code).not.toContain('baseURL:');
  });

  it('buildTempConfig full 模式继承项目配置', () => {
    const code = buildTempConfig(
      baseOpts,
      '/project',
      undefined,
      'full',
      '/project/playwright.config.ts',
    );
    expect(code).toContain('import baseConfig from "/project/playwright.config.ts"');
    expect(code).toContain('...baseConfig');
    expect(code).not.toContain('testDir:');
    expect(code).not.toContain('testMatch:');
  });
});
