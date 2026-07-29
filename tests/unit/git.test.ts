import { describe, it, expect } from 'vitest';
import { readChangedFiles, getGitRoot, isGitRepo } from '../../src/git/git-diff-reader.js';
import { analyzeChanges } from '../../src/git/change-analyzer.js';

function fakeExec(responses: Record<string, { stdout: string; stderr: string }>) {
  return async (cmd: string) => {
    const key = Object.keys(responses).find((k) => cmd.startsWith(k));
    if (!key) throw new Error(`unexpected cmd: ${cmd}`);
    return responses[key]!;
  };
}

describe('git-diff-reader', () => {
  it('getGitRoot 返回 toplevel', async () => {
    const exec = fakeExec({ 'git rev-parse': { stdout: '/repo\n', stderr: '' } });
    const root = await getGitRoot('/repo', exec as never);
    expect(root).toBe('/repo');
  });

  it('isGitRepo 在命令失败时返回 false', async () => {
    const exec = async () => {
      throw new Error('not a repo');
    };
    expect(await isGitRepo('/x', exec as never)).toBe(false);
  });

  it('readChangedFiles 合并 tracked 与 untracked', async () => {
    const exec = fakeExec({
      'git rev-parse --show-toplevel': { stdout: '/repo\n', stderr: '' },
      'git diff --name-status': {
        stdout: 'M\tsrc/a.ts\nA\tsrc/b.ts\nD\told/c.ts\n',
        stderr: '',
      },
      'git ls-files --others --exclude-standard': {
        stdout: 'src/new.ts\nsrc/a.ts\n',
        stderr: '',
      },
    });
    const changes = await readChangedFiles({ projectRoot: '/repo', exec: exec as never });
    expect(changes.root).toBe('/repo');
    // 去重：src/a.ts 同时出现在两边。
    expect(changes.files).toEqual(['src/a.ts', 'src/b.ts', 'old/c.ts', 'src/new.ts']);
  });
});

describe('change-analyzer', () => {
  it('按目录与文件类型归类', () => {
    const summary = analyzeChanges({
      root: '/repo',
      files: [
        'src/pages/users/index.tsx',
        'src/api/users.ts',
        'server/controllers/user.ts',
        'src/components/Button.tsx',
        'README.md',
      ],
      raw: '',
    });
    expect(summary.fileCount).toBe(5);
    expect(summary.routeFiles).toEqual(['src/pages/users/index.tsx']);
    expect(summary.apiFiles).toEqual(['src/api/users.ts', 'server/controllers/user.ts']);
    expect(summary.componentFiles).toEqual(['src/components/Button.tsx']);
    expect(summary.byDirectory['src']).toBeDefined();
    expect(summary.byDirectory['server']).toEqual(['server/controllers/user.ts']);
  });
});
