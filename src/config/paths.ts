import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function autoE2EHome(): string {
  return process.env.AUTO_E2E_HOME
    ? resolveProjectPath(process.cwd(), process.env.AUTO_E2E_HOME)
    : path.join(os.homedir(), '.auto-e2e');
}

export function workspaceId(projectRoot: string): string {
  const resolved = path.resolve(projectRoot);
  const canonical = existsSync(resolved) ? realpathSync(resolved) : resolved;
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function resolveProjectPath(projectRoot: string, value: string): string {
  const expanded = value === '~' ? os.homedir()
    : value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value;
  return path.resolve(projectRoot, expanded);
}

export function defaultStoragePaths(projectRoot: string) {
  const legacyRoot = path.resolve(projectRoot, '.auto-e2e');
  // Keep the entire legacy layout together; merely having specs/config is not a marker.
  const hasLegacyStorage = ['history.sqlite', 'history.sqlite-wal', 'history.sqlite-shm',
    'history.sqlite-journal', 'artifacts', 'reports'].some((entry) => existsSync(path.join(legacyRoot, entry)));
  const root = !process.env.AUTO_E2E_HOME && hasLegacyStorage
    ? legacyRoot : path.join(autoE2EHome(), 'projects', workspaceId(projectRoot));
  return {
    databasePath: path.join(root, 'history.sqlite'),
    outputDirectory: path.join(root, 'reports'),
    artifactDirectory: path.join(root, 'artifacts'),
  };
}
