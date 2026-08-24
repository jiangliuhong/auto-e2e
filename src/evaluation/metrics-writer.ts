import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EvaluationMetricsSchema,
  type EvaluationMetrics,
} from '../domain/evaluation-metrics.js';

export async function writeEvaluationMetrics(
  projectRoot: string,
  metrics: EvaluationMetrics,
): Promise<string> {
  const validated = EvaluationMetricsSchema.parse(metrics);
  const directory = path.join(projectRoot, '.auto-e2e', 'evaluation', 'runs', metrics.runId);
  await fs.mkdir(directory, { recursive: true });
  const output = path.join(directory, 'metrics.json');
  await fs.writeFile(output, JSON.stringify(validated, null, 2) + '\n', 'utf8');
  return output;
}
