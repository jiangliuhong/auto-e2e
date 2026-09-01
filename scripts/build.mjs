import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

await fs.rm(new URL('../dist', import.meta.url), { recursive: true, force: true });

const executable = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
const child = spawn(executable, ['-p', 'tsconfig.json'], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  shell: false,
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('close', (code) => resolve(code ?? 1));
});
if (exitCode === 0 && process.platform !== 'win32') {
  await fs.chmod(new URL('../dist/cli.js', import.meta.url), 0o755);
}
process.exit(exitCode);
