import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';

let storageHome: string;
beforeAll(async () => {
  storageHome = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-test-home-'));
});
beforeEach(() => vi.stubEnv('AUTO_E2E_HOME', storageHome));
afterAll(async () => {
  vi.unstubAllEnvs();
  await fs.rm(storageHome, { recursive: true, force: true });
});
