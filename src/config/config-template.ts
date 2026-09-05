import YAML from 'yaml';
import { AutoE2EConfigSchema, type ProjectConfigFile } from './config-schema.js';

const descriptions: { [Section in keyof ProjectConfigFile]: Record<keyof ProjectConfigFile[Section], string> } = {
  project: {
    name: '项目名称，默认使用当前项目目录名。',
    baseUrl: '被测应用地址；运行验收前请启动应用并修改为实际地址。',
  },
  acceptance: {
    databasePath: 'SQLite 历史数据库路径；下方为自定义示例，省略时自动选择存储位置。',
    model: 'BetterWright 使用的模型。',
    profile: 'BetterWright 浏览器配置名称，用于复用登录状态。',
    headed: '是否显示浏览器窗口：true 显示，false 无头运行。',
    concurrency: '验收并发数，整数，范围 1–32。',
    forbiddenActions: '禁止执行的操作；自定义列表会替换默认列表。',
  },
  report: {
    outputDirectory: '报告输出目录；下方为自定义示例，省略时自动选择存储位置。',
    artifactDirectory: '截图等验收产物目录；下方为自定义示例，省略时自动选择存储位置。',
  },
};

export function configTemplate(projectName: string): string {
  const defaults = AutoE2EConfigSchema.parse({
    project: { name: projectName, baseUrl: 'http://127.0.0.1:3000' },
  });
  const sections = {
    project: defaults.project,
    acceptance: { ...defaults.acceptance, databasePath: '.auto-e2e/history.sqlite' },
    report: { outputDirectory: '.auto-e2e/reports', artifactDirectory: '.auto-e2e/artifacts' },
  };
  const lines = [
    '# auto-e2e 项目配置',
    '# 已注释的配置按需取消注释；除存储路径示例外，展示的均为默认值。',
    '# 启用可选配置时，请同时取消对应分组行的注释。',
    '# 相对路径以项目根目录为基准，也支持绝对路径和 ~/。',
    '# 存储默认位于 ~/.auto-e2e/projects/<工作区 ID>/，可通过 AUTO_E2E_HOME 修改根目录。',
    '# 未设置 AUTO_E2E_HOME 且项目已有历史数据库、reports 或 artifacts 时，沿用项目 .auto-e2e/。',
  ];
  for (const section of ['project', 'acceptance', 'report'] as const) {
    const prefix = section === 'project' ? '' : '# ';
    lines.push('', `${prefix}${section}:`);
    for (const [key, value] of Object.entries(sections[section])) {
      const notes: Record<string, string> = descriptions[section];
      lines.push(`  # ${notes[key]}`);
      for (const line of YAML.stringify({ [key]: value }).trimEnd().split('\n')) {
        lines.push(`${prefix}  ${line}`);
      }
    }
  }
  return `${lines.join('\n')}\n`;
}
