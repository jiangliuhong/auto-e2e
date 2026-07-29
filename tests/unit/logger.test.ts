import { describe, it, expect } from 'vitest';
import { Logger } from '../../src/runtime/logger.js';

function makeSink() {
  const lines: string[] = [];
  return { lines, sink: (l: string) => void lines.push(l) };
}

describe('Logger', () => {
  it('默认级别 info 下输出 info 及以上，不输出 debug', () => {
    const { lines, sink } = makeSink();
    const log = new Logger({ sink });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(lines.some((l) => l.includes('d'))).toBe(false);
    expect(lines.filter((l) => l.includes('[INFO]')).length).toBe(1);
    expect(lines.filter((l) => l.includes('[WARN]')).length).toBe(1);
    expect(lines.filter((l) => l.includes('[ERROR]')).length).toBe(1);
  });

  it('JSON 模式默认 silent，info 不输出但 error 仍始终输出', () => {
    const { lines, sink } = makeSink();
    const log = new Logger({ json: true, sink });
    log.info('hidden');
    log.error('shown');
    expect(lines.some((l) => l.includes('hidden'))).toBe(false);
    // error 即使在 silent 级别下也始终输出到 stderr
    expect(lines.some((l) => l.includes('shown'))).toBe(true);
  });

  it('显式 level 覆盖 JSON 静默', () => {
    const { lines, sink } = makeSink();
    const log = new Logger({ json: true, level: 'error', sink });
    log.info('no');
    log.error('yes');
    expect(lines.some((l) => l.includes('no'))).toBe(false);
    expect(lines.some((l) => l.includes('yes'))).toBe(true);
  });

  it('child logger 继承前缀并叠加', () => {
    const { lines, sink } = makeSink();
    const log = new Logger({ prefix: 'auto-e2e', level: 'info', sink });
    log.child('verify').info('hi');
    expect(lines.some((l) => l.includes('auto-e2e:verify') && l.includes('hi'))).toBe(true);
  });
});
