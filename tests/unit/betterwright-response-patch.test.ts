import { afterEach, describe, expect, it, vi } from 'vitest';
import { endpointModel, runAgentTask } from 'betterwright/agent';

const completedResponse = JSON.stringify({
  status: 'completed',
  output: [{
    type: 'function_call',
    call_id: 'call_done',
    name: 'done',
    arguments: JSON.stringify({ answer: 'ok' }),
  }],
  usage: {},
});

function createModel(fetchImpl: typeof fetch) {
  return endpointModel({
    source: 'custom',
    baseURL: 'http://127.0.0.1:8787/v1',
    model: 'test-model',
    protocol: 'responses',
    fetchImpl,
  });
}

async function runWithModel(model: ReturnType<typeof createModel>) {
  return runAgentTask({
    task: 'Return the final answer.',
    model,
    browser: { vault: null } as never,
    liveView: false,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BetterWright Responses truncation patch', () => {
  it('retries an empty successful response without repeating browser actions', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let attempts = 0;
    const fetchImpl: typeof fetch = vi.fn(async () => {
      attempts += 1;
      return new Response(attempts === 1 ? '' : completedResponse, { status: 200 });
    });

    const result = await runWithModel(createModel(fetchImpl));

    expect(attempts).toBe(2);
    expect(result).toMatchObject({ ok: true, reason: 'done', answer: 'ok', toolCalls: 1 });
  });

  it('retries an SSE response that ends before response.completed', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let attempts = 0;
    const fetchImpl: typeof fetch = vi.fn(async () => {
      attempts += 1;
      const body = attempts === 1
        ? 'data: {"type":"response.output_text.delta","delta":"partial"}\n\n'
        : completedResponse;
      return new Response(body, { status: 200 });
    });

    const result = await runWithModel(createModel(fetchImpl));

    expect(attempts).toBe(2);
    expect(result).toMatchObject({ ok: true, reason: 'done', answer: 'ok' });
  });

  it('returns a structured model_error after bounded retries are exhausted', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchImpl: typeof fetch = vi.fn(async () => new Response('', { status: 200 }));

    const result = await runWithModel(createModel(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      ok: false,
      reason: 'model_error',
      steps: 1,
      toolCalls: 0,
      proof: null,
    });
    expect(result.transcript).toEqual([
      expect.objectContaining({ role: 'user', text: 'Return the final answer.' }),
    ]);
  });
});
