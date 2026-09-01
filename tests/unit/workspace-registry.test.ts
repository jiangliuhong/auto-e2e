import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceRegistry } from '../../src/workspace/workspace-registry.js';

describe('WorkspaceRegistry', () => {
  let root: string;
  let registry: WorkspaceRegistry;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-workspaces-'));
    registry = new WorkspaceRegistry(path.join(root, 'registry', 'workspaces.json'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('注册工作区并移除已经不存在的目录', async () => {
    const workspace = path.join(root, 'demo');
    await fs.mkdir(workspace);
    await fs.writeFile(path.join(workspace, '.auto-e2e.yaml'), `project:\n  name: demo\n  baseUrl: http://127.0.0.1:3000\n`, 'utf8');

    const added = await registry.add(workspace);
    expect(added.name).toBe('demo');
    expect(await registry.list()).toHaveLength(1);

    await fs.rm(workspace, { recursive: true });
    expect(await registry.list()).toEqual([]);
    const persisted = JSON.parse(await fs.readFile(path.join(root, 'registry', 'workspaces.json'), 'utf8'));
    expect(persisted.workspaces).toEqual([]);
  });

  it('拒绝注册不存在的目录', async () => {
    await expect(registry.add(path.join(root, 'missing'))).rejects.toThrow('工作区不存在');
  });
});
