import { describe, it, expect } from 'vitest';
import { parse as yamlParse } from 'yaml';
import { AutoE2EConfigSchema } from '../../src/config/config-schema.js';
import { loadConfig } from '../../src/config/config-loader.js';
import { writeInitArtifacts, configToYaml } from '../../src/config/config-writer.js';
import { defaultConfig } from '../../src/config/defaults.js';
import { AutoE2EError } from '../../src/runtime/exit-codes.js';

describe('config schema', () => {
  it('默认配置通过校验并填充所有默认值', () => {
    const cfg = defaultConfig();
    expect(cfg.agent.implementation).toBe('mock');
    expect(cfg.browser.explorer).toBe('betterwright');
    expect(cfg.browser.implementation).toBe('mock');
    expect(cfg.playwright.retries).toBe(1);
    expect(cfg.report.formats).toEqual(['console', 'json', 'html', 'junit']);
    // allowSourceModification 固定 false。
    expect(cfg.generation.allowSourceModification).toBe(false);
  });

  it('allowSourceModification 不允许设为 true', () => {
    const r = AutoE2EConfigSchema.safeParse({
      project: { name: 'a', baseUrl: 'http://x', startCommand: 'x', healthUrl: 'http://x' },
      generation: { allowSourceModification: true },
    });
    expect(r.success).toBe(false);
  });
});

describe('config env overrides', () => {
  it('环境变量覆盖配置值（含数字/布尔转换）', async () => {
    const original = { ...process.env };
    process.env['AUTO_E2E_PROJECT_BASEURL'] = 'http://localhost:4000';
    process.env['AUTO_E2E_PLAYWRIGHT_RETRIES'] = '3';
    process.env['AUTO_E2E_BROWSER_HEADLESS'] = 'false';
    try {
      const cfg = await loadConfig({
        projectRoot: '/nonexistent-for-test',
        fallbackToDefault: true,
      });
      expect(cfg.project.baseUrl).toBe('http://localhost:4000');
      expect(cfg.playwright.retries).toBe(3);
      expect(cfg.browser.headless).toBe(false);
    } finally {
      process.env = original;
    }
  });
});

describe('init writer', () => {
  it('写入 config.yaml 与 task-spec.json，并追加 .gitignore 缺失条目', async () => {
    const files = new Map<string, string>();
    const written = await writeInitArtifacts({
      projectRoot: '/proj',
      config: defaultConfig(),
      writeFile: async (f, d) => void files.set(f, d),
      mkdir: async () => undefined,
      readFile: async (f) => files.get(f) ?? (() => { throw new Error('ENOENT'); })(),
    });
    const configYaml = files.get('/proj/.auto-e2e/config.yaml')!;
    expect(configYaml).toContain('demo-web');
    const taskSpec = JSON.parse(files.get('/proj/.auto-e2e/task-spec.json')!);
    expect(taskSpec.taskId).toBe('TASK-20260729-001');
    expect(written.gitignoreUpdated).toBe(true);
  });

  it('配置已存在且未 --force 时抛错', async () => {
    const files = new Map<string, string>([['/proj/.auto-e2e/config.yaml', 'existing']]);
    await expect(
      writeInitArtifacts({
        projectRoot: '/proj',
        config: defaultConfig(),
        writeFile: async (f, d) => void files.set(f, d),
        mkdir: async () => undefined,
        readFile: async (f) => files.get(f) ?? (() => { throw new Error('ENOENT'); })(),
      }),
    ).rejects.toThrow(/已存在/);
  });
});

describe('config error -> exit code 7', () => {
  it('configToYaml 输出可被重新解析', () => {
    const yaml = configToYaml(defaultConfig());
    const reparsed = AutoE2EConfigSchema.safeParse(yamlParse(yaml));
    expect(reparsed.success).toBe(true);
  });

  it('AutoE2EError 配置错误退出码为 7', () => {
    const err = new AutoE2EError(7, '配置错误');
    expect(err.exitCode).toBe(7);
  });
});
