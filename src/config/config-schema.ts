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
  /** false 表示应用由外部托管，不执行本地启动命令或裸 HTTP 健康检查。 */
  manageApplication: z.boolean().default(true),
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
  explorer: z.enum(['playwright', 'betterwright']).default('playwright').transform(() => 'playwright' as const),
  browser: z.literal('chromium').default('chromium'),
  channel: z.enum(['chrome', 'msedge', 'chromium']).default('chrome'),
  headless: z.boolean().default(true),
  sessionProfile: z
    .string()
    .regex(
      /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]*$/,
      '只能包含字母、数字、点、下划线和连字符，且不能包含 ..',
    )
    .default('admin'),
  timeout: z.number().int().positive().default(30000),
  /** 实现类型：mock（默认，离线闭环）/ real（真实浏览器）。 */
  implementation: z.enum(['mock', 'real']).default('mock'),
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;

const AuthenticationDisabledSchema = z.object({
  enabled: z.literal(false),
}).strict();

const AuthenticationUrlSchema = z.string().url().refine(
  (raw) => {
    const url = new URL(raw);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  },
  '认证 URL 只能使用 http/https，且不得包含凭据、查询参数或片段',
);

const AuthenticationEnabledSchema = z.object({
  enabled: z.literal(true),
  /** 受保护入口。访问它会触发 SSO，成功后应回到业务页面。 */
  entryUrl: AuthenticationUrlSchema,
  /** 最终 URL 必须以此前缀开头。 */
  successUrlPrefix: AuthenticationUrlSchema,
  /** 业务页面中必须存在的 Playwright selector。 */
  successSelector: z.string().min(1),
  /** 人工认证最长等待时间（ms）。 */
  interactiveTimeout: z.number().int().positive(),
}).strict();

export const AuthenticationConfigSchema = z
  .discriminatedUnion('enabled', [
    AuthenticationDisabledSchema,
    AuthenticationEnabledSchema,
  ])
  .default({ enabled: false });

export type AuthenticationConfig = z.infer<typeof AuthenticationConfigSchema>;

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

export const KnowledgeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxFiles: z.number().int().min(1).max(20).default(3),
  maxCharacters: z.number().int().positive().default(12000),
});
export type KnowledgeConfig = z.infer<typeof KnowledgeConfigSchema>;

export const AutoE2EConfigSchema = z.object({
  project: ProjectConfigSchema,
  agent: AgentConfigSchema.default({}),
  browser: BrowserConfigSchema.default({}),
  authentication: AuthenticationConfigSchema,
  playwright: PlaywrightConfigSchema.default({}),
  generation: GenerationConfigSchema.default({}),
  report: ReportConfigSchema.default({}),
  knowledge: KnowledgeConfigSchema.default({}),
});

export type AutoE2EConfig = z.infer<typeof AutoE2EConfigSchema>;
