import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
for (const directory of ['prompts', 'knowledge']) {
  await fs.cp(
    path.join(root, 'src', 'agent', directory),
    path.join(root, 'dist', 'agent', directory),
    { recursive: true },
  );
}
