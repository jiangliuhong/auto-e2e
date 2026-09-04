import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AcceptanceCriterionResult,
  AcceptanceResultAssertion,
  AcceptanceRun,
  AcceptanceWorkflowStepResult,
} from '../domain/acceptance-run.js';

export type ReportExportFormat = 'html' | 'markdown';

interface ExportOptions {
  projectRoot: string;
  artifactDirectory: string;
}

interface ReportCase {
  caseId: string | null;
  source: AcceptanceRun['source'];
  status: AcceptanceRun['status'];
  summary: string;
  criteria: AcceptanceCriterionResult[];
  workflowSteps?: AcceptanceWorkflowStepResult[];
  resultAssertions?: AcceptanceResultAssertion[];
  specDigest?: string;
  error: string | null;
}

export async function exportAcceptanceReport(
  run: AcceptanceRun,
  format: ReportExportFormat,
  options: ExportOptions,
): Promise<string> {
  const proofCache = new Map<string, Promise<string | null>>();
  const proofSource = (proof: string | null): Promise<string | null> => {
    if (!proof) return Promise.resolve(null);
    const cached = proofCache.get(proof);
    if (cached) return cached;
    const loading = readProofDataUri(proof, options);
    proofCache.set(proof, loading);
    return loading;
  };
  return format === 'html'
    ? renderHtml(run, proofSource)
    : renderMarkdown(run, proofSource);
}

function reportCases(run: AcceptanceRun): ReportCase[] {
  if (run.schemaVersion === 2) return run.cases;
  return [{
    caseId: null,
    source: run.source,
    status: run.status,
    summary: run.summary,
    criteria: run.criteria,
    workflowSteps: run.workflowSteps,
    resultAssertions: run.resultAssertions,
    specDigest: run.specDigest,
    error: run.error,
  }];
}

async function renderMarkdown(
  run: AcceptanceRun,
  proofSource: (proof: string | null) => Promise<string | null>,
): Promise<string> {
  const lines = [
    `# ${markdownText(run.source.title)}`,
    '',
    `> ${statusLabel(run.status)} · ${markdownText(run.summary || '无摘要')}`,
    '',
    '| 项目 | 值 |',
    '| --- | --- |',
    `| 运行 ID | \`${markdownCode(run.runId)}\` |`,
    `| 项目 | ${markdownCell(run.project)} |`,
    `| 目标地址 | ${markdownCell(run.targetUrl)} |`,
    `| Commit | ${markdownCell(run.commit ?? '无')} |`,
    `| Profile / Model | ${markdownCell(`${run.profile} / ${run.model}`)} |`,
    `| 开始 / 结束 | ${markdownCell(`${formatDate(run.startedAt)} / ${formatDate(run.finishedAt)}`)} |`,
    `| 耗时 | ${formatDuration(run.durationMs)} |`,
    `| 步骤数 | ${run.steps} |`,
    '',
    '## 需求背景',
    '',
    fence(run.source.content),
    '',
  ];

  if (run.error) lines.push('## 异常信息', '', fence(run.error), '');
  const overallProof = await markdownProof(run.proof, '总体截图证据', proofSource);
  if (overallProof) lines.push('## 总体证据', '', overallProof, '');

  const cases = reportCases(run);
  for (const [index, testCase] of cases.entries()) {
    const prefix = cases.length > 1 ? `用例 ${index + 1}：` : '';
    lines.push(`## ${prefix}${markdownText(testCase.caseId ? `${testCase.caseId} · ${testCase.source.title}` : '验收结果')}`, '');
    lines.push(`**状态：${statusLabel(testCase.status)}**`, '', markdownText(testCase.summary || '无摘要'), '');
    if (testCase.specDigest) lines.push(`Spec：\`${markdownCode(testCase.specDigest)}\``, '');
    if (testCase.error) lines.push('**异常信息**', '', fence(testCase.error), '');

    if (testCase.workflowSteps?.length) {
      lines.push('### 业务步骤', '');
      for (const step of testCase.workflowSteps) {
        lines.push(`#### ${markdownText(step.id)} · ${statusLabel(step.status)}`, '',
          `- 操作：${markdownText(step.instruction)}`,
          `- 预期：${markdownText(step.expected)}`,
          `- 实际：${markdownText(step.actual)}`);
        if (step.durationMs !== undefined) lines.push(`- 耗时：${formatDuration(step.durationMs)}`);
        if (step.error) lines.push(`- 错误：${markdownText(step.error)}`);
        const proof = await markdownProof(step.proof, `${step.id} 截图证据`, proofSource);
        lines.push('', proof ?? '_无截图证据_', '');
      }
    }

    if (testCase.resultAssertions?.length) {
      lines.push('### 结果断言', '');
      for (const result of testCase.resultAssertions) {
        lines.push(`#### ${markdownText(result.id)} · ${markdownText(result.name)} · ${statusLabel(result.status)}`, '',
          `- 比较方式：${markdownText(result.match)}`,
          `- 期望：${inlineValue(result.expected)}`,
          `- 实际：${inlineValue(result.actual)}`);
        if (result.difference !== undefined) lines.push(`- 差异：${inlineValue(result.difference)}`);
        if (result.error) lines.push(`- 错误：${markdownText(result.error)}`);
        const proof = await markdownProof(result.proof, `${result.id} 截图证据`, proofSource);
        lines.push('', proof ?? '_无截图证据_', '');
      }
    }

    if (!testCase.workflowSteps?.length && !testCase.resultAssertions?.length) {
      lines.push('### 验收标准', '');
      for (const criterion of testCase.criteria) {
        lines.push(`#### ${markdownText(criterion.id)} · ${statusLabel(criterion.status)}`, '',
          markdownText(criterion.description), '',
          `**实际结果：** ${markdownText(criterion.actual)}`, '');
        const proof = await markdownProof(criterion.proof, `${criterion.id} 截图证据`, proofSource);
        lines.push(proof ?? '_无截图证据_', '');
      }
    }
  }
  lines.push('---', '', `由 auto-e2e 于 ${formatDate(new Date().toISOString())} 导出。`, '');
  return lines.join('\n');
}

async function renderHtml(
  run: AcceptanceRun,
  proofSource: (proof: string | null) => Promise<string | null>,
): Promise<string> {
  const cases = reportCases(run);
  const caseSections = await Promise.all(cases.map(async (testCase, index) => {
    const sections: string[] = [];
    if (testCase.workflowSteps?.length) {
      sections.push('<h3>业务步骤</h3>', await renderHtmlItems(testCase.workflowSteps.map((step) => ({
        id: step.id, status: step.status, title: step.instruction,
        rows: [['预期', step.expected], ['实际', step.actual], ...(step.durationMs === undefined ? [] : [['耗时', formatDuration(step.durationMs)]]), ...(step.error ? [['错误', step.error]] : [])],
        proof: step.proof,
      })), proofSource));
    }
    if (testCase.resultAssertions?.length) {
      sections.push('<h3>结果断言</h3>', await renderHtmlItems(testCase.resultAssertions.map((result) => ({
        id: result.id, status: result.status, title: result.name,
        rows: [['比较方式', result.match], ['期望', displayValue(result.expected)], ['实际', displayValue(result.actual)], ...(result.difference === undefined ? [] : [['差异', displayValue(result.difference)]]), ...(result.error ? [['错误', result.error]] : [])],
        proof: result.proof,
      })), proofSource));
    }
    if (!testCase.workflowSteps?.length && !testCase.resultAssertions?.length) {
      sections.push('<h3>验收标准</h3>', await renderHtmlItems(testCase.criteria.map((criterion) => ({
        id: criterion.id, status: criterion.status, title: criterion.description,
        rows: [['实际结果', criterion.actual]], proof: criterion.proof,
      })), proofSource));
    }
    const heading = run.schemaVersion === 2
      ? `用例 ${index + 1}：${testCase.caseId} · ${testCase.source.title}` : '验收结果';
    return `<section class="case"><div class="case-heading"><div><h2>${html(heading)}</h2><p>${html(testCase.summary || '无摘要')}</p></div>${statusBadge(testCase.status)}</div>` +
      (testCase.specDigest ? `<p class="digest">Spec: ${html(testCase.specDigest)}</p>` : '') +
      (testCase.error ? `<div class="error"><strong>异常信息</strong><pre>${html(testCase.error)}</pre></div>` : '') +
      sections.join('') + '</section>';
  }));
  const overallProof = await htmlProof(run.proof, '总体截图证据', proofSource);

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(run.source.title)} · auto-e2e 验收报告</title>
<style>
:root{color-scheme:light;--ink:#172033;--muted:#667085;--line:#dbe1ea;--soft:#f7f8fa;--ok:#067647;--okbg:#ecfdf3;--bad:#b42318;--badbg:#fef3f2;--warn:#b54708;--warnbg:#fffaeb}*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:var(--ink);font:14px/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{max-width:1040px;margin:32px auto;padding:0 20px 48px}.hero,.case{background:#fff;border:1px solid var(--line);border-radius:14px;padding:24px;margin-bottom:18px;box-shadow:0 2px 8px #1018280a}.hero h1,.case h2{margin:0}.summary{font-size:16px;color:#344054}.meta{width:100%;border-collapse:collapse;margin-top:18px}.meta th,.meta td{padding:8px 10px;text-align:left;border-top:1px solid #eaecf0;vertical-align:top}.meta th{width:150px;color:var(--muted);font-weight:500}.case-heading,.item-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.case-heading p{margin:4px 0;color:var(--muted)}h3{margin:24px 0 10px}.item{border:1px solid var(--line);border-left-width:4px;border-radius:10px;padding:16px;margin:10px 0}.item.passed{border-left-color:var(--ok)}.item.failed,.item.error{border-left-color:var(--bad)}.item.blocked,.item.skipped{border-left-color:var(--warn)}.item h4{font-size:14px;margin:0}.rows{margin:10px 0 0;display:grid;grid-template-columns:120px 1fr;gap:5px 12px}.rows dt{color:var(--muted)}.rows dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.badge{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}.badge.passed{color:var(--ok);background:var(--okbg)}.badge.failed,.badge.error{color:var(--bad);background:var(--badbg)}.badge.blocked,.badge.skipped{color:var(--warn);background:var(--warnbg)}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:14px}.proof{margin:14px 0 0}.proof img{display:block;max-width:100%;height:auto;border:1px solid var(--line);border-radius:8px}.proof figcaption,.digest,.footer{color:var(--muted);font-size:12px}.error{color:var(--bad);background:var(--badbg);padding:12px;border-radius:8px;margin-top:12px}@media print{body{background:#fff}.page{max-width:none;margin:0}.hero,.case{box-shadow:none;break-inside:avoid}}
</style></head><body><main class="page">
<section class="hero"><div class="case-heading"><div><h1>${html(run.source.title)}</h1><p class="summary">${html(run.summary || '无摘要')}</p></div>${statusBadge(run.status)}</div>
<table class="meta"><tbody>${[
    ['运行 ID', run.runId], ['项目', run.project], ['目标地址', run.targetUrl], ['Commit', run.commit ?? '无'],
    ['Profile / Model', `${run.profile} / ${run.model}`], ['开始时间', formatDate(run.startedAt)],
    ['结束时间', formatDate(run.finishedAt)], ['耗时', formatDuration(run.durationMs)], ['步骤数', String(run.steps)],
  ].map(([key, value]) => `<tr><th>${html(key)}</th><td>${html(value)}</td></tr>`).join('')}</tbody></table>
<h3>需求背景</h3><pre>${html(run.source.content)}</pre>${run.error ? `<div class="error"><strong>异常信息</strong><pre>${html(run.error)}</pre></div>` : ''}${overallProof ?? ''}</section>
${caseSections.join('\n')}<p class="footer">由 auto-e2e 于 ${html(formatDate(new Date().toISOString()))} 导出。</p>
</main></body></html>`;
}

interface HtmlItem {
  id: string;
  status: string;
  title: string;
  rows: string[][];
  proof: string | null;
}

async function renderHtmlItems(items: HtmlItem[], proofSource: (proof: string | null) => Promise<string | null>): Promise<string> {
  return (await Promise.all(items.map(async (item) =>
    `<article class="item ${html(item.status)}"><div class="item-heading"><h4>${html(item.id)} · ${html(item.title)}</h4>${statusBadge(item.status)}</div>` +
    `<dl class="rows">${item.rows.map(([key, value]) => `<dt>${html(key)}</dt><dd>${html(value)}</dd>`).join('')}</dl>` +
    `${await htmlProof(item.proof, `${item.id} 截图证据`, proofSource) ?? '<p class="digest">无截图证据</p>'}</article>`,
  ))).join('');
}

async function htmlProof(proof: string | null, label: string, resolve: (proof: string | null) => Promise<string | null>): Promise<string | null> {
  if (!proof) return null;
  const source = await resolve(proof);
  return source
    ? `<figure class="proof"><figcaption>${html(label)}</figcaption><img src="${source}" alt="${html(label)}"></figure>`
    : `<p class="digest">${html(label)}不可用</p>`;
}

async function markdownProof(proof: string | null, label: string, resolve: (proof: string | null) => Promise<string | null>): Promise<string | null> {
  if (!proof) return null;
  const source = await resolve(proof);
  return source ? `![${markdownAlt(label)}](${source})` : `_${markdownText(label)}不可用_`;
}

async function readProofDataUri(proof: string, options: ExportOptions): Promise<string | null> {
  const root = path.resolve(options.projectRoot, options.artifactDirectory);
  const candidate = path.isAbsolute(proof) ? path.resolve(proof) : path.resolve(options.projectRoot, proof);
  try {
    const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(candidate)]);
    if (!realFile.startsWith(`${realRoot}${path.sep}`)) return null;
    const extension = path.extname(realFile).toLowerCase();
    const mime = extension === '.png' ? 'image/png'
      : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg'
        : extension === '.webp' ? 'image/webp' : null;
    if (!mime) return null;
    return `data:${mime};base64,${(await fs.readFile(realFile)).toString('base64')}`;
  } catch {
    return null;
  }
}

function statusBadge(status: string): string {
  return `<span class="badge ${html(status)}">${html(statusLabel(status))}</span>`;
}

function statusLabel(status: string): string {
  return ({ passed: '通过', failed: '失败', blocked: '阻塞', error: '异常', skipped: '跳过' } as Record<string, string>)[status] ?? status;
}

function formatDuration(durationMs: number): string {
  return durationMs < 1000 ? `${durationMs} ms` : `${(durationMs / 1000).toFixed(2)} s`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function displayValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function inlineValue(value: unknown): string {
  return `\`${markdownCode(typeof value === 'string' ? value : JSON.stringify(value))}\``;
}

function fence(value: string): string {
  const marker = value.includes('```') ? '````' : '```';
  return `${marker}\n${value}\n${marker}`;
}

function html(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function markdownText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|\-])/g, '\\$1')
    .replace(/\r?\n/g, '<br>');
}

function markdownCell(value: string): string {
  return markdownText(value).replace(/\|/g, '\\|');
}

function markdownCode(value: string): string {
  return value.replace(/`/g, '\\`').replace(/\r?\n/g, ' ');
}

function markdownAlt(value: string): string {
  return value.replace(/[\[\]\\]/g, '\\$&');
}
