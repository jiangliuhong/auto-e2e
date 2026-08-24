import fs from 'node:fs/promises';
import path from 'node:path';

const [root, port, mode] = process.argv.slice(2);
if (!root || !port || !mode) throw new Error('usage: prepare-validation-fixture <root> <port> <mock|real>');
const template = await fs.readFile(path.join(root, 'config.template.yaml'), 'utf8');
const config = template
  .replaceAll('__PORT__', port)
  .replace('__AGENT__', mode === 'real' ? 'sdk' : 'mock')
  .replace('__BROWSER__', mode === 'real' ? 'real' : 'mock');
await fs.mkdir(path.join(root, '.auto-e2e'), { recursive: true });
await fs.writeFile(path.join(root, '.auto-e2e', 'config.yaml'), config);
await fs.copyFile(path.join(root, 'task-spec.json'), path.join(root, '.auto-e2e', 'task-spec.json'));
