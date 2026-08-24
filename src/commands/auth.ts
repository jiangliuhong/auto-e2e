import type { Command } from 'commander';
import { ExitCode, AutoE2EError } from '../runtime/exit-codes.js';
import type { RunOptions, CommandResult } from '../runtime/run-with-exit.js';
import { runCommand } from '../runtime/run-with-exit.js';
import { mergeGlobalOpts } from '../runtime/global-options.js';
import { loadConfig } from '../config/config-loader.js';
import { createPiClient } from '../agent/pi-client-factory.js';
import {
  AuthenticationManager,
  authenticationTargets,
} from '../auth/authentication-manager.js';
import type { AuthenticationTarget } from '../auth/auth-types.js';

export interface AuthLoginOptions extends RunOptions {}

export interface AuthBrowserOptions extends RunOptions {
  profile?: string;
  target?: 'all' | AuthenticationTarget;
}

export interface AuthStatusOptions extends RunOptions {
  profile?: string;
  target?: 'all' | AuthenticationTarget;
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
    const target = parseTarget(opts.target);
    const manager = new AuthenticationManager({
      projectRoot: ctx.projectRoot,
      config,
      profile,
    });
    const statuses = await manager.prepare(authenticationTargets(target), {
      nonInteractive: ctx.nonInteractive,
    });
    const message = `业务认证已准备（profile: ${profile}, target: ${target}）`;
    return {
      exitCode: ExitCode.Ok,
      json: {
        ok: true,
        enabled: true,
        profile,
        targets: statuses,
      },
      message,
    };
  });
}

export async function authStatusCommand(opts: AuthStatusOptions): Promise<number> {
  return runCommand(opts, async (ctx) => {
    const config = await loadConfig({ projectRoot: ctx.projectRoot });
    const profile = opts.profile ?? config.browser.sessionProfile;
    const target = parseTarget(opts.target);
    const manager = new AuthenticationManager({
      projectRoot: ctx.projectRoot,
      config,
      profile,
    });
    const statuses = await manager.status(authenticationTargets(target));
    const authenticated =
      manager.enabled &&
      authenticationTargets(target).every((item) => statuses[item]?.authenticated);
    return {
      exitCode: ExitCode.Ok,
      json: {
        ok: true,
        enabled: manager.enabled,
        authenticated,
        profile,
        targets: statuses,
      },
      message: manager.enabled
        ? `业务认证状态：${authenticated ? '有效' : '无效'}（profile: ${profile}）`
        : '业务认证未启用',
    };
  });
}

function parseTarget(target?: string): 'all' | AuthenticationTarget {
  const value = target ?? 'all';
  if (value !== 'all' && value !== 'explorer' && value !== 'runner') {
    throw new AutoE2EError(
      ExitCode.ConfigError,
      `无效的认证目标：${value}（允许 all、explorer、runner）`,
    );
  }
  return value;
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
    .description('分别准备 BetterWright 与 Playwright 的业务系统认证')
    .option('--profile <name>', '浏览器身份 Profile 名称')
    .option('--target <target>', '认证目标：all | explorer | runner', 'all')
    .action(async (opts) => {
      const code = await authBrowserCommand(mergeGlobalOpts(opts, program) as AuthBrowserOptions);
      process.exit(code);
    });

  auth
    .command('status')
    .description('在线检查 BetterWright 与 Playwright 的业务认证状态')
    .option('--profile <name>', '浏览器身份 Profile 名称')
    .option('--target <target>', '检查目标：all | explorer | runner', 'all')
    .action(async (opts) => {
      const code = await authStatusCommand(mergeGlobalOpts(opts, program) as AuthStatusOptions);
      process.exit(code);
    });
}
