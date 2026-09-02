import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('npm publish script', () => {
  it('dry run performs local verification without authentication or publication', async () => {
    const fixture = await createFixture({ dirty: true });
    const result = await runScript(fixture, ['--dry-run', '--tag', 'next']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Dry run complete for @jarome/auto-e2e@0.3.0');
    expect(await readCalls(fixture)).toEqual([
      'npm ci',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'npm pack --dry-run',
    ]);
  });

  it('publishes a clean, unpublished version and verifies it on npmjs.com', async () => {
    const fixture = await createFixture({ dirty: false });
    const result = await runScript(fixture, []);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Published @jarome/auto-e2e@0.3.0 with dist-tag latest');
    expect(await readCalls(fixture)).toEqual([
      'git status --porcelain',
      'npm whoami --registry https://registry.npmjs.org',
      'npm view @jarome/auto-e2e@0.3.0 version --registry https://registry.npmjs.org',
      'npm ci',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'npm pack --dry-run',
      'npm publish --access public --tag latest --registry https://registry.npmjs.org',
      'npm view @jarome/auto-e2e@0.3.0 version --registry https://registry.npmjs.org',
    ]);
  });

  it('refuses to publish from a dirty Git working tree by default', async () => {
    const fixture = await createFixture({ dirty: true });
    const result = await runScript(fixture, []);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Git working tree is not clean');
    expect(await readCalls(fixture)).toEqual(['git status --porcelain']);
  });

  it('refuses to overwrite a version that already exists on npmjs.com', async () => {
    const fixture = await createFixture({ dirty: false, published: true });
    const result = await runScript(fixture, []);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('@jarome/auto-e2e@0.3.0 already exists');
    expect(await readCalls(fixture)).toEqual([
      'git status --porcelain',
      'npm whoami --registry https://registry.npmjs.org',
      'npm view @jarome/auto-e2e@0.3.0 version --registry https://registry.npmjs.org',
    ]);
  });
});

async function createFixture(options: { dirty: boolean; published?: boolean }): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-publish-'));
  roots.push(root);
  await fs.mkdir(path.join(root, 'scripts'));
  await fs.mkdir(path.join(root, 'bin'));
  await fs.copyFile(
    path.resolve('scripts/publish-npm.sh'),
    path.join(root, 'scripts', 'publish-npm.sh'),
  );
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: '@jarome/auto-e2e', version: '0.3.0' }),
  );
  if (options.published) {
    await fs.writeFile(path.join(root, 'published'), 'yes');
  }

  await writeExecutable(path.join(root, 'bin', 'git'), `#!/usr/bin/env bash
printf 'git %s\\n' "$*" >> ${JSON.stringify(path.join(root, 'calls.log'))}
${options.dirty ? "printf ' M README.md\\n'" : ':'}
`);
  await writeExecutable(path.join(root, 'bin', 'npm'), `#!/usr/bin/env bash
printf 'npm %s\\n' "$*" >> ${JSON.stringify(path.join(root, 'calls.log'))}
if [ "$1" = 'whoami' ]; then
  printf 'publisher\\n'
elif [ "$1" = 'view' ]; then
  if [ -f ${JSON.stringify(path.join(root, 'published'))} ]; then
    printf '0.3.0\\n'
  else
    printf 'npm error code E404\\n' >&2
    exit 1
  fi
elif [ "$1" = 'publish' ]; then
  touch ${JSON.stringify(path.join(root, 'published'))}
fi
`);
  return root;
}

async function writeExecutable(file: string, contents: string): Promise<void> {
  await fs.writeFile(file, contents, 'utf8');
  await fs.chmod(file, 0o700);
}

async function runScript(root: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn('bash', [path.join(root, 'scripts', 'publish-npm.sh'), ...args], {
    cwd: root,
    env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH ?? ''}` },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const code = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode) => resolve(exitCode ?? 1));
  });
  return { code, stdout, stderr };
}

async function readCalls(root: string): Promise<string[]> {
  const content = await fs.readFile(path.join(root, 'calls.log'), 'utf8');
  return content.trim().split('\n');
}
