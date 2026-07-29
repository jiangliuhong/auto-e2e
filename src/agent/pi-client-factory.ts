/**
 * PiClient 工厂：根据配置选择 mock 或 sdk 实现。
 */
import type { PiClient } from './pi-client.js';
import { MockPiClient } from './mock-pi-client.js';
import { SdKPiClient } from './sdk-pi-client.js';
import type { AgentConfig } from '../config/config-schema.js';

export interface PiClientFactoryOptions {
  agent: AgentConfig;
}

export function createPiClient(opts: PiClientFactoryOptions): PiClient {
  if (opts.agent.implementation === 'sdk') {
    return new SdKPiClient();
  }
  return new MockPiClient();
}
