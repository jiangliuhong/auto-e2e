import type { AutoE2EConfig } from '../config/config-schema.js';
import { AutoE2EError, ExitCode } from '../runtime/exit-codes.js';
import type {
  AuthenticationAdapter,
  AuthenticationCheck,
  AuthenticationTarget,
} from './auth-types.js';
import { ExplorerAuthenticationAdapter } from './explorer-auth.js';
import { PlaywrightAuthenticationAdapter } from './playwright-auth.js';

export interface AuthenticationManagerOptions {
  projectRoot: string;
  config: AutoE2EConfig;
  profile?: string;
  promptSink?: (message: string) => void;
  explorer?: {
    prepare(): Promise<AuthenticationCheck>;
    check(): Promise<AuthenticationCheck>;
  };
  runner?: {
    prepare(): Promise<AuthenticationCheck>;
    check(): Promise<AuthenticationCheck>;
  };
}

export class AuthenticationManager {
  readonly enabled: boolean;
  readonly profile: string;
  private readonly explorer?: AuthenticationAdapter;
  private readonly runner?: AuthenticationAdapter;

  constructor(private readonly opts: AuthenticationManagerOptions) {
    this.enabled = opts.config.authentication.enabled;
    this.profile = opts.profile ?? opts.config.browser.sessionProfile;
    if (!opts.config.authentication.enabled) return;

    this.explorer =
      opts.explorer ??
      new ExplorerAuthenticationAdapter({
        authentication: opts.config.authentication,
        browser: opts.config.browser,
        profile: this.profile,
        promptSink: opts.promptSink,
      });
    this.runner =
      opts.runner ??
      new PlaywrightAuthenticationAdapter({
        projectRoot: opts.projectRoot,
        authentication: opts.config.authentication,
        profile: this.profile,
        checkTimeout: opts.config.browser.timeout,
        promptSink: opts.promptSink,
      });
  }

  async prepare(
    targets: AuthenticationTarget[],
    options: { nonInteractive: boolean },
  ): Promise<Partial<Record<AuthenticationTarget, AuthenticationCheck>>> {
    this.assertEnabled();
    if (options.nonInteractive) {
      throw new AutoE2EError(
        ExitCode.AuthFailed,
        '非交互模式下无法完成人工业务认证',
      );
    }
    const result: Partial<Record<AuthenticationTarget, AuthenticationCheck>> = {};
    for (const target of targets) {
      result[target] = await this.adapter(target).prepare();
    }
    return result;
  }

  async status(
    targets: AuthenticationTarget[],
  ): Promise<Partial<Record<AuthenticationTarget, AuthenticationCheck>>> {
    if (!this.enabled) return {};
    const result: Partial<Record<AuthenticationTarget, AuthenticationCheck>> = {};
    for (const target of targets) {
      result[target] = await this.adapter(target).check();
    }
    return result;
  }

  async assertReady(targets: AuthenticationTarget[]): Promise<{
    runnerStatePath?: string;
  }> {
    if (!this.enabled) return {};
    const statuses = await this.status(targets);
    for (const target of targets) {
      const status = statuses[target];
      if (!status?.authenticated) {
        throw new AutoE2EError(
          ExitCode.AuthFailed,
          `${target === 'explorer' ? 'Explorer' : 'Runner'} 认证不可用：${
            status?.reason ?? '未知原因'
          }。请运行 auto-e2e auth browser --profile ${this.profile} --target ${target}`,
        );
      }
    }
    return { runnerStatePath: statuses.runner?.statePath };
  }

  private adapter(target: AuthenticationTarget) {
    const adapter = target === 'explorer' ? this.explorer : this.runner;
    if (!adapter) {
      throw new AutoE2EError(ExitCode.ConfigError, '业务认证尚未启用');
    }
    return adapter;
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new AutoE2EError(
        ExitCode.ConfigError,
        '业务认证未启用；请先在 config.yaml 中设置 authentication.enabled: true',
      );
    }
  }
}

export function authenticationTargets(
  target: 'all' | AuthenticationTarget,
): AuthenticationTarget[] {
  return target === 'all' ? ['explorer', 'runner'] : [target];
}
