import fs from 'node:fs/promises';
import path from 'node:path';

const [root, firstPath, secondPath] = process.argv.slice(2);
const first = JSON.parse(await fs.readFile(firstPath, 'utf8'));
const second = JSON.parse(await fs.readFile(secondPath, 'utf8'));
if (!first.ok || !second.ok) throw new Error('Mock verify did not pass');
if (!first.runId || !second.runId || first.runId === second.runId) throw new Error('runId must be unique');
for (const result of [first, second]) {
  const historical = JSON.parse(await fs.readFile(result.runResultJsonPath, 'utf8'));
  if (historical.runId !== result.runId || historical.schemaVersion !== 2) {
    throw new Error(`invalid historical result for ${result.runId}`);
  }
  const metricsPath = path.join(root, '.auto-e2e', 'evaluation', 'runs', result.runId, 'metrics.json');
  const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
  if (metrics.runId !== result.runId || metrics.schemaVersion !== 1) throw new Error('invalid metrics');
}
const latest = JSON.parse(await fs.readFile(path.join(root, '.auto-e2e', 'reports', 'latest', 'result.json'), 'utf8'));
if (latest.runId !== second.runId) throw new Error('latest does not reference second run');
process.stdout.write(`validated runs ${first.runId} and ${second.runId}\n`);
