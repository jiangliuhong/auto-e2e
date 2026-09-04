import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BetterWrightCli } from '../../src/acceptance/betterwright-cli.js';

// This executable emulates the CLI boundary, including a reused small page.
// It executes the actual initialization snippet against the page API and
// records the dimensions seen by view/exec, rather than matching prompt text.
describe('BetterWright desktop viewport', () => {
  let root: string;
  let client: BetterWrightCli;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-e2e-viewport-'));
    const binary = path.join(root, 'fake-cli.cjs');
    await fs.writeFile(binary, `#!/usr/bin/env node
const fs = require('node:fs');
const vm = require('node:vm');
const args = process.argv.slice(2);
const file = 'pages.json';
const sizes = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [{width:800,height:513},{width:800,height:513}];
const pages = sizes.map((size) => ({ setViewportSize: async value => Object.assign(size,value), viewportSize: () => size }));
(async () => {
  if (args[0] === 'run') {
    let code=''; for await (const part of process.stdin) code+=part;
    const profile = args[args.indexOf('--profile') + 1];
    if (process.env.NEWER_PROFILE === profile) {
      console.log(JSON.stringify({ok:false,error:'Browser profile at /profiles/'+profile+' was upgraded by a newer Chromium (152.0.7977.75) than the one launching now (151.0.7922.108)'})); return;
    }
    if (process.env.REJECT_VIEWPORT) { console.log(JSON.stringify({ok:false,error:'resize rejected'})); return; }
    const result = await vm.runInNewContext('(async()=>{'+code+'})()', { pages, page:pages[0] });
    fs.writeFileSync(file,JSON.stringify(sizes));
    console.log(JSON.stringify({ok:true,result}));
  } else {
    fs.appendFileSync('calls.jsonl',JSON.stringify({args,sizes,chromiumArgs:process.env.BETTERWRIGHT_CHROMIUM_ARGS,chromiumPath:process.env.BETTERWRIGHT_CHROMIUM_PATH})+'\\n');
    if (args[0] === 'view') {
      console.log('Live view: http://127.0.0.1:4567/');
      setInterval(()=>{},1000);
    } else if (args[0] === 'exec') {
      process.stdin.resume();
      console.log(JSON.stringify({ok:true,answer:'done'}));
    }
  }
})();
`, { mode: 0o700 });
    client = new BetterWrightCli({ cwd: root, binary, env: { ...process.env, BETTERWRIGHT_CHROMIUM_ARGS: '--disk-cache-size=104857600' } });
  });
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

  it('resizes existing session pages before showing Live View and preserves launch switches for new tabs', async () => {
    const viewer = await client.startLiveView({ profile: 'qa', session: 'existing', headed: true });
    try {
      const [call] = (await fs.readFile(path.join(root, 'calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      expect(call.sizes).toEqual([{width:1440,height:900},{width:1440,height:900}]);
      expect(call.args).toContain('--headed');
      expect(call.chromiumArgs).toContain('--window-size=1440,1000');
      expect(call.chromiumArgs).toContain('--disk-cache-size=104857600');
    } finally { await viewer.close(); }
  });

  it('initializes the same desktop viewport before CLI acceptance, including fresh conversations', async () => {
    await client.exec({ prompt:'verify', model:'test', profile:'qa', session:'existing', fresh:true });
    const call = JSON.parse((await fs.readFile(path.join(root, 'calls.jsonl'), 'utf8')).trim());
    expect(call.args).toContain('--fresh');
    expect(call.sizes).toEqual([{width:1440,height:900},{width:1440,height:900}]);
  });

  it('does not start a viewer when the viewport cannot be initialized', async () => {
    const rejecting = new BetterWrightCli({ cwd:root, binary:path.join(root,'fake-cli.cjs'), env:{...process.env,REJECT_VIEWPORT:'1'} });
    await expect(rejecting.startLiveView({profile:'qa',session:'existing'})).rejects.toThrow('resize rejected');
    await expect(fs.access(path.join(root,'calls.jsonl'))).rejects.toThrow();
  });

  it('preserves a newer Chromium profile and consistently uses a versioned compatibility profile', async () => {
    const compatible = new BetterWrightCli({
      cwd:root, binary:path.join(root,'fake-cli.cjs'), env:{
        ...process.env, NEWER_PROFILE:'qa', BETTERWRIGHT_CHROMIUM_PATH:'/Applications/Google Chrome',
      },
    });
    const viewer = await compatible.startLiveView({profile:'qa',session:'existing'});
    try {
      expect(viewer.profile).toBe('qa-bw151-managed');
      const call = JSON.parse((await fs.readFile(path.join(root,'calls.jsonl'),'utf8')).trim());
      expect(call.args).toEqual(expect.arrayContaining(['--profile','qa-bw151-managed']));
      expect(call.chromiumPath).toBeUndefined();
      await compatible.exec({prompt:'verify',model:'test',profile:'qa',session:'existing'});
      const calls = (await fs.readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
      expect(calls.at(-1).args).toEqual(expect.arrayContaining(['--profile','qa-bw151-managed']));
    } finally { await viewer.close(); }
  });
});
