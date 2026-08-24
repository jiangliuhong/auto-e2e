import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const [projectRoot, cliPath] = process.argv.slice(2);
if (!projectRoot || !cliPath) throw new Error('usage: run-real-benchmark <projectRoot> <cliPath>');
const manifest = JSON.parse(
  await fs.readFile(path.join(projectRoot, 'benchmark-manifest.json'), 'utf8'),
);
const results = [];
for (const scenario of manifest.scenarios) {
  if (scenario.coveredBy) {
    results.push({ id: scenario.id, matched: true, coveredBy: scenario.coveredBy });
    continue;
  }
  const specPath = path.join(projectRoot, '.auto-e2e', `benchmark-${scenario.id}.json`);
  await fs.writeFile(specPath, JSON.stringify({
    taskId: scenario.id,
    title: scenario.title,
    requirement: scenario.requirement,
    acceptanceCriteria: scenario.acceptanceCriteria,
    changedFiles: ['server.mjs'],
    changedRoutes: [scenario.route],
  }, null, 2));
  const run = await execute(process.execPath, [
    cliPath, '--project-root', projectRoot, '--non-interactive', '--json',
    'verify', '--spec', specPath,
  ]);
  let payload;
  try { payload = JSON.parse(run.stdout); } catch { payload = { status: 'error' }; }
  const actualStatus = payload.status ?? 'error';
  const categories = Array.isArray(payload.failures)
    ? payload.failures.map((failure) => failure.category)
    : await categoriesFromLatest(projectRoot);
  const statusMatched = actualStatus === scenario.expectedStatus;
  const categoryMatched = scenario.expectedCategory === null ||
    categories.includes(scenario.expectedCategory);
  results.push({
    id: scenario.id, expectedStatus: scenario.expectedStatus, actualStatus,
    expectedCategory: scenario.expectedCategory, categories,
    exitCode: run.exitCode, matched: statusMatched && categoryMatched,
  });
}
const evaluated = results.filter((item) => !item.coveredBy);
const defects = results.filter((item) => item.expectedCategory === 'product_defect');
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scenarioCount: results.length,
  matchedCount: results.filter((item) => item.matched).length,
  knownDefectRecall: defects.length === 0 ? null :
    defects.filter((item) => item.matched).length / defects.length,
  executionRate: evaluated.length === 0 ? null :
    evaluated.filter((item) => item.actualStatus !== 'error').length / evaluated.length,
  results,
};
const output = path.join(projectRoot, '.auto-e2e', 'benchmark-report.json');
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(`benchmark report: ${output}\n`);
if (results.some((item) => !item.matched)) process.exitCode = 1;

async function categoriesFromLatest(root) {
  try {
    const result = JSON.parse(await fs.readFile(
      path.join(root, '.auto-e2e', 'reports', 'latest', 'result.json'), 'utf8',
    ));
    return (result.failures ?? []).map((failure) => failure.category);
  } catch { return []; }
}

async function execute(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, exitCode: code ?? 9 }));
  });
}
