import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';

describe('demo benchmark contract', () => {
  it('declares eight uniquely identified scenarios', async () => {
    const manifest = JSON.parse(
      await fs.readFile('examples/demo-app/benchmark-manifest.json', 'utf8'),
    ) as { schemaVersion: number; scenarios: Array<{ id: string }> };
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.scenarios).toHaveLength(8);
    expect(new Set(manifest.scenarios.map((item) => item.id)).size).toBe(8);
  });
});
