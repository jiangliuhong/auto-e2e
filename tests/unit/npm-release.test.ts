import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { checkRelease } from '../../scripts/check-npm-release.mjs';

interface FixtureOptions {
  version?: string;
  tag?: string;
  lockVersion?: string;
  lockedRootVersion?: string;
  onMain?: boolean;
  registryCode?: number;
  registryOutput?: string;
  registryError?: Error;
}

function createFixture(options: FixtureOptions = {}) {
  const version = options.version ?? '0.3.1';
  const pkg = { name: '@jarome/auto-e2e', version };
  const runCommand = vi.fn((command: string) => command === 'git'
    ? { status: options.onMain === false ? 1 : 0 }
    : {
      status: options.registryCode ?? 1,
      stdout: options.registryOutput ?? JSON.stringify({ error: { code: 'E404' } }),
      error: options.registryError,
    });
  return {
    runCommand,
    check: () => checkRelease({
      pkg,
      lock: { ...pkg, version: options.lockVersion ?? version, packages: { '': { ...pkg, version: options.lockedRootVersion ?? version } } },
      releaseTag: options.tag ?? `v${version}`,
      runCommand,
    }),
  };
}

describe('npm tag release preflight', () => {
  it('allows an unpublished stable version on main and selects latest', () => {
    const fixture = createFixture();
    expect(fixture.check()).toMatchObject({ published: false, distTag: 'latest', version: '0.3.1' });
    expect(fixture.runCommand).toHaveBeenNthCalledWith(1, 'git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'], {
      encoding: 'utf8', timeout: 30_000,
    });
    expect(fixture.runCommand).toHaveBeenNthCalledWith(2, 'npm', [
      'view', '@jarome/auto-e2e@0.3.1', 'version', '--json', '--registry', 'https://registry.npmjs.org',
    ], { encoding: 'utf8', timeout: 30_000 });
  });

  it('routes prerelease versions to next', () => {
    expect(createFixture({ version: '0.4.0-rc.1' }).check()).toMatchObject({ published: false, distTag: 'next' });
  });

  it('skips an existing version instead of publishing it again', () => {
    const result = createFixture({ version: '0.3.0', registryCode: 0, registryOutput: '"0.3.0"' }).check();
    expect(result.published).toBe(true);
    expect(result.message).toContain('skipping publication');
  });

  it.each([
    [{ tag: 'v9.9.9' }, 'Release tag must match'],
    [{ lockVersion: '0.3.0' }, 'package-lock.json name/version'],
    [{ lockedRootVersion: '0.3.0' }, 'package-lock.json name/version'],
    [{ onMain: false }, 'Release commit must be reachable from origin/main'],
  ] satisfies [FixtureOptions, string][])('rejects invalid metadata or ancestry: %j', (options, message) => {
    const fixture = createFixture(options);
    expect(fixture.check).toThrow(message);
    expect(fixture.runCommand.mock.calls.some(([command]) => command === 'npm')).toBe(false);
  });

  it.each([
    { error: { code: 'E401' } },
    { error: { code: 'E403' } },
    { error: { code: 'ENETUNREACH' } },
  ])('does not treat registry error %j as an available version', (error) => {
    expect(createFixture({ registryOutput: JSON.stringify(error) }).check).toThrow('only E404 means unpublished');
  });

  it('rejects invalid registry output', () => {
    expect(createFixture({ registryOutput: 'connection failed' }).check).toThrow('invalid JSON');
  });

  it('rejects registry timeouts even when stdout contains an E404', () => {
    expect(createFixture({ registryError: new Error('ETIMEDOUT') }).check).toThrow('Could not query npm');
  });

  it('rejects an unexpected successful registry response', () => {
    expect(createFixture({ registryCode: 0, registryOutput: '"0.3.0"' }).check).toThrow('Could not confirm');
  });
});

describe('GitHub workflow release gates', () => {
  it('only releases pushed tags with OIDC, full history and verification before publishing', async () => {
    const workflow = parseDocument(await fs.readFile('.github/workflows/release-npm.yml', 'utf8'));
    expect(workflow.errors).toEqual([]);
    const data: unknown = workflow.toJS();
    const config = z.object({
      on: z.unknown(), permissions: z.unknown(), concurrency: z.object({ 'cancel-in-progress': z.boolean() }),
      jobs: z.object({ publish: z.object({ permissions: z.unknown(), steps: z.array(z.object({
        uses: z.string().optional(), run: z.string().optional(), id: z.string().optional(),
        if: z.string().optional(), with: z.record(z.unknown()).optional(), env: z.record(z.string()).optional(),
      })) }) }),
    }).parse(data);
    expect(config.on).toEqual({ push: { tags: ['v*.*.*'] } });
    expect(config.permissions).toEqual({ contents: 'read' });
    expect(config.jobs.publish.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
    expect(config.concurrency['cancel-in-progress']).toBe(false);
    const steps = config.jobs.publish.steps;
    expect(steps[0]?.with).toMatchObject({ 'fetch-depth': 0, 'persist-credentials': false });
    expect(steps.find((step) => step.uses?.startsWith('actions/setup-node@'))?.with)
      .toMatchObject({ 'node-version': '24', 'package-manager-cache': false });
    const preflight = steps.findIndex((step) => step.run === 'node scripts/check-npm-release.mjs');
    const verify = steps.findIndex((step) => step.run === 'npm run publish:npm -- --dry-run');
    const publish = steps.findIndex((step) => step.run?.startsWith('npm publish '));
    expect(preflight).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(preflight);
    expect(publish).toBeGreaterThan(verify);
    expect(steps[preflight]?.env).toEqual({ RELEASE_TAG: '${{ github.ref_name }}' });
    expect(steps[verify]?.if).toBe("steps.release.outputs.published == 'false'");
    expect(steps[publish]?.if).toBe("steps.release.outputs.published == 'false'");
    expect(steps[publish]?.env).toEqual({ NPM_DIST_TAG: '${{ steps.release.outputs.dist_tag }}' });
  });

  it('tests main and pull requests without publishing permissions', async () => {
    const workflow = parseDocument(await fs.readFile('.github/workflows/ci.yml', 'utf8'));
    expect(workflow.errors).toEqual([]);
    const data: unknown = workflow.toJS();
    expect(data).toMatchObject({
      on: { pull_request: { branches: ['main'] }, push: { branches: ['main'] } },
      permissions: { contents: 'read' },
      jobs: { check: { strategy: { matrix: { node: ['22.18.0', '24'] } } } },
    });
  });
});
