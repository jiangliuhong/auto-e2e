/**
 * 目标项目配置文件 schema（plan §7）。
 *
 * 安全约束：密码/Token/Cookie 不允许写入此配置；
 * generation.allowSourceModification 第一版固定为 false。
 */
import { z } from 'zod';

const reportFormats = z.array(
  z.enum(['console', 'json', 'html', 'junit']),
);

export const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  startCommand: z.string(),
  healthUrl: z.string().url(),
  startupTimeout: z.number().int().positive().default(120000),
});

export const AgentConfigSchema = z.object({
  /** 实现类型：mock（默认，离线闭环）/ sdk（真实 Pi SDK）。 */
  implementation: z.enum(['mock', 'sdk']).default('mock'),
  provider: z.string().default('chatgpt-oauth'),
  model: z.string().default('default'),
  thinkingLevel: z.enum(['low', 'medium', 'high']).default('high'),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const BrowserConfigSchema = z.object({
  explorer: z.literal('betterwright').default('betterwright'),
  browser: z.literal('chromium').default('chromium'),
  headless: z.boolean().default(true),
  sessionProfile: z.string().default('admin'),
  timeout: z.number().int().positive().default(30000),
  /** 实现类型：mock（默认，离线闭环）/ real（真实浏览器）。 */
  implementation: z.enum(['mock', 'real']).default('mock'),
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;

export const PlaywrightConfigSchema = z.object({
  configFile: z.string().default('playwright.config.ts'),
  generatedDirectory: z.string().default('.auto-e2e/generated'),
  retries: z.number().int().min(0).default(1),
  workers: z.number().int().positive().default(1),
  trace: z.enum(['off', 'on', 'retain-on-failure', 'on-first-retry']).default('retain-on-failure'),
  screenshot: z.enum(['off', 'on', 'only-on-failure', 'on-first-retry']).default('only-on-failure'),
  video: z.enum(['off', 'on', 'retain-on-failure', 'on-first-retry']).default('retain-on-failure'),
});

export const GenerationConfigSchema = z.object({
  requireAcceptanceCriteria: z.boolean().default(true),
  preferTestId: z.boolean().default(true),
  /** 第一版固定为 false，禁止修改业务代码。 */
  allowSourceModification: z.literal(false).default(false),
  maxTestsPerTask: z.number().int().positive().default(10),
  overwriteGeneratedTests: z.boolean().default(true),
});

export const ReportConfigSchema = z.object({
  outputDirectory: z.string().default('.auto-e2e/reports'),
  artifactDirectory: z.string().default('.auto-e2e/artifacts'),
  formats: reportFormats.default(['console', 'json', 'html', 'junit']),
});

export const AutoE2EConfigSchema = z.object({
  project: ProjectConfigSchema,
  agent: AgentConfigSchema.default({}),
  browser: BrowserConfigSchema.default({}),
  playwright: PlaywrightConfigSchema.default({}),
  generation: GenerationConfigSchema.default({}),
  report: ReportConfigSchema.default({}),
});

export type AutoE2EConfig = z.infer<typeof AutoE2EConfigSchema>;
