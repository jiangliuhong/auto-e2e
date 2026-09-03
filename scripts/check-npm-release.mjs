import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const registry = 'https://registry.npmjs.org';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function checkRelease({ pkg, lock, releaseTag, runCommand = spawnSync }) {
  if (!isObject(pkg) || typeof pkg.name !== 'string' || typeof pkg.version !== 'string'
    || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
    throw new Error('package.json must contain a name and a release version (for example 0.3.1 or 0.4.0-rc.1).');
  }
  if (pkg.private === true) {
    throw new Error('Cannot release a private package.');
  }
  if (releaseTag !== `v${pkg.version}`) {
    throw new Error(`Release tag must match package.json exactly: v${pkg.version}.`);
  }
  const lockedRoot = isObject(lock) && isObject(lock.packages) ? lock.packages[''] : undefined;
  if (!isObject(lock) || lock.name !== pkg.name || lock.version !== pkg.version
    || !isObject(lockedRoot) || lockedRoot.name !== pkg.name || lockedRoot.version !== pkg.version) {
    throw new Error('package-lock.json name/version must match package.json at both root entries.');
  }

  const ancestry = runCommand('git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'], {
    encoding: 'utf8', timeout: 30_000,
  });
  if (ancestry.error || ancestry.status !== 0) {
    throw new Error('Release commit must be reachable from origin/main. Merge first and fetch full history before tagging.');
  }

  const lookup = runCommand('npm', ['view', `${pkg.name}@${pkg.version}`, 'version', '--json', '--registry', registry], {
    encoding: 'utf8', timeout: 30_000,
  });
  if (lookup.error) {
    throw new Error('Could not query npm version availability; refusing to publish.');
  }
  let result;
  try {
    result = JSON.parse(lookup.stdout);
  } catch {
    throw new Error('npm returned invalid JSON while checking version availability; refusing to publish.');
  }
  const published = lookup.status === 0 && result === pkg.version;
  const notFound = lookup.status !== 0 && isObject(result) && isObject(result.error) && result.error.code === 'E404';
  if (!published && !notFound) {
    throw new Error('Could not confirm npm version availability (only E404 means unpublished); refusing to publish.');
  }
  const distTag = pkg.version.includes('-') ? 'next' : 'latest';
  const message = published
    ? `${pkg.name}@${pkg.version} already exists on npmjs; skipping publication. This does not verify the original release commit.`
    : `${pkg.name}@${pkg.version} is ready for publication with dist-tag ${distTag}.`;
  return { published, distTag, version: pkg.version, message };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkRelease({
      pkg: JSON.parse(readFileSync('package.json', 'utf8')),
      lock: JSON.parse(readFileSync('package-lock.json', 'utf8')),
      releaseTag: process.env.RELEASE_TAG,
    });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `published=${result.published}\ndist_tag=${result.distTag}\nversion=${result.version}\n`);
    }
    console.log(result.message);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Release preflight failed.');
    process.exitCode = 1;
  }
}
