import { z } from 'zod';

export const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
});

export const AcceptanceConfigSchema = z.object({
  databasePath: z.string().min(1).default('.auto-e2e/history.sqlite'),
  model: z.string().min(1).default('gpt-5.6-sol'),
  profile: z.string().regex(/^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]*$/).default('auto-e2e'),
  headed: z.boolean().default(false),
  concurrency: z.number().int().min(1).max(32).default(1),
  forbiddenActions: z.array(z.string().min(1)).default([
    '删除数据',
    '发布或部署',
    '发起付款或购买',
    '向外部人员发送消息',
  ]),
});

export const ReportConfigSchema = z.object({
  outputDirectory: z.string().min(1).default('.auto-e2e/reports'),
  artifactDirectory: z.string().min(1).default('.auto-e2e/artifacts'),
});

export const AutoE2EConfigSchema = z.object({
  project: ProjectConfigSchema,
  acceptance: AcceptanceConfigSchema.default({}),
  report: ReportConfigSchema.default({}),
});

export type AutoE2EConfig = z.infer<typeof AutoE2EConfigSchema>;
