import { randomUUID } from 'node:crypto';

export function createRunId(now = new Date(), uuid = randomUUID()): string {
  const timestamp = now.toISOString().replace(/[-:.]/g, '');
  return `${timestamp}-${uuid.replace(/-/g, '').slice(0, 8)}`;
}
