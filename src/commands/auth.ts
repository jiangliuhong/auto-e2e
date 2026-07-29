import type { Command } from 'commander';
import { ExitCode, AutoE2EError } from '../runtime/exit-codes.js';
import type { RunOptions, CommandResult } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { loadConfig } from '../config/config-loader.js';
import { createPiClient } from '../agent/pi-client-factory.js';
import { SessionManager } from '../betterwright/session-manager.js';

export interface AuthLoginOptions extends RunOptions {}

export interface AuthBrowserOptions extends RunOptions {
  profile?: string;
}

export async function authLoginCommand(opts: AuthLoginOptions): Promise<number> {
  return runCommand<AuthLoginResult>(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const client = createPiClient({ agent: config.agent });
    const status = await client.checkAuth();
    if (status.authenticated) {
      const message = `已认证${status.provider ? `（${status.provider}）` : ''}`;
      ctx.logger.info(message);
      return {
        exitCode: ExitCode.Ok,
        json: { ok: true, authenticated: true, provider: status.provider },
        message,
      };
    }
    // 未认证：sdk 模式下引导登录，非交互模式直接失败（plan §18）。
    if (ctx.nonInteractive) {
      throw new AutoE2EError(ExitCode.AuthFailed, '非交互模式下无法完成 OAuth 登录');
    }
    const loginStatus = await client.login();
    if (!loginStatus.authenticated) {
      // login() 在 sdk 模式返回引导信息而非真正登录（真实登录需交互式终端）。
      const message = loginStatus.message ?? '登录未完成';
      ctx.logger.warn(message);
      return {
        exitCode: ExitCode.Ok,
        json: { ok: true, authenticated: false, message },
        message,
      };
    }
    return {
      exitCode: ExitCode.Ok,
      json: { ok: true, authenticated: true },
      message: '登录成功',
    };
  });
}

interface AuthLoginResult {
  ok: boolean;
  authenticated: boolean;
  provider?: string;
  message?: string;
}

export async function authBrowserCommand(opts: AuthBrowserOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const profile = opts.profile ?? config.browser.sessionProfile;
    const manager = new SessionManager({ browser: config.browser });
    const client = manager.getOrCreate(profile);
    try {
      if (config.browser.implementation === 'real') {
        // 真实模式：打开 baseUrl 让用户手动登录，完成后保存 Session。
        ctx.logger.info(`请在打开的浏览器中完成 ${config.project.baseUrl} 的登录，完成后回到终端`);
        const res = await client.run(
          `await page.goto('${config.project.baseUrl}')`,
        );
        if (!res.ok) {
          throw new AutoE2EError(ExitCode.BrowserFailed, `打开浏览器失败：${res.error ?? '未知错误'}`);
        }
      } else {
        ctx.logger.info(`mock 模式：已为 profile ${profile} 创建虚拟会话`);
      }
      const message = `浏览器会话已保存（profile: ${profile}）`;
      return {
        exitCode: ExitCode.Ok,
        json: { ok: true, profile },
        message,
      };
    } finally {
      await manager.closeAll();
    }
  });
}

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('管理 ChatGPT OAuth 与浏览器业务登录');

  auth
    .command('login')
    .description('触发 ChatGPT OAuth 登录并保存认证信息')
    .action(async (opts) => {
      const code = await authLoginCommand(mergeGlobalOpts(opts, program) as AuthLoginOptions);
      process.exit(code);
    });

  auth
    .command('browser')
    .description('使用 BetterWright 打开浏览器完成业务系统登录并保存 Session')
    .option('--profile <name>', '浏览器 Session Profile 名称', 'admin')
    .action(async (opts) => {
      const code = await authBrowserCommand(mergeGlobalOpts(opts, program) as AuthBrowserOptions);
      process.exit(code);
    });
}
