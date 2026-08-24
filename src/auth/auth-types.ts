export type AuthenticationTarget = 'explorer' | 'runner';

export interface AuthenticationCheck {
  authenticated: boolean;
  statePath?: string;
  reason?: string;
}

export interface AuthenticationTargetStatus {
  explorer?: AuthenticationCheck;
  runner?: AuthenticationCheck;
}

export interface AuthenticationAdapter {
  prepare(): Promise<AuthenticationCheck>;
  check(): Promise<AuthenticationCheck>;
}
