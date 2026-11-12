import { afterEach, describe, expect, it, vi } from 'vitest';
import { launch, planRequests, fusionCompletion } from './openrouter';
import type { Model } from './models';
import {
  newProject,
  parseProject,
  reserved,
  spent,
  canSpend,
  remainingBudget,
  uncertainSpend,
  type Project
} from '$lib/domain/project';
import { exampleProject } from '$lib/domain/example';
import { FUSION_MODEL } from '$lib/domain/model-settings';
import { projectJSON } from '$lib/export/files';
const fusion: Model = {
  id: FUSION_MODEL,
  name: 'Fusion',
  pricing: { prompt: '-1', completion: '-1' },
  context_length: null
};
const direct: Model = {
  id: 'example/thinking',
  name: 'Thinking',
  context_length: 128000,
  pricing: { prompt: '.000001', completion: '.000002' },
  reasoning: { supported_efforts: ['high', 'low'], default_effort: 'low' }
};
const proposal = {
  drivers: [{ title: 'Housing access', summary: 'Access to safe accommodation.', tags: ['Social'] }]
};
function result(cost: number | undefined = 0.15, text = JSON.stringify(proposal)) {
  return {
    status: 'completed',
    model: 'resolved/outer',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Intermediate commentary' }]
      },
      { type: 'openrouter:fusion', status: 'completed' },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }
    ],
    usage: { input_tokens: 100, output_tokens: 500, ...(cost === undefined ? {} : { cost }) }
  };
}
function harness(initial = newProject()) {
  let p = initial;
  vi.stubGlobal('navigator', { onLine: true });
  return {
    get: () => p,
    change: (fn: (p: Project) => void) => {
      const next = structuredClone(p);
      fn(next);
      p = next;
    }
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Fusion planning and accounting', () => {
  it('requires a remaining exercise budget and retains unavailable Fusion as blocked', () => {
    for (const budget of [null, 0, -1, NaN, Infinity]) {
      const p = newProject();
      p.budget = budget;
      expect(planRequests(p, [fusion], 'drivers', [FUSION_MODEL]).estimatedTotal).toBeNull();
    }
    expect(planRequests(newProject(), [], 'drivers', [FUSION_MODEL]).estimatedTotal).toBeNull();
    expect(planRequests(newProject(), [fusion], 'drivers', [FUSION_MODEL]).estimatedTotal).toBe(5);
  });
  it('reserves the remaining exercise budget divided across rating batches', () => {
    const p = exampleProject();
    p.stage = 2;
    p.budget = 1.2;
    p.drivers = Array.from({ length: 21 }, (_, i) => ({
      ...structuredClone(p.drivers[0]),
      id: `driver-${i}`,
      ratings: [],
      approved: true
    }));
    const plan = planRequests(p, [fusion], 'ratings', [FUSION_MODEL]);
    expect(plan.requests).toHaveLength(3);
    expect(plan.estimatedTotal).toBe(1.2);
    expect(
      plan.requests.every((r) => r.costBasis === 'allowance' && r.reasoningEffort === 'high')
    ).toBe(true);
  });
  it('checks budget before dispatch and never permits Fusion alongside individual contributors', () => {
    const p = newProject();
    p.budget = 0;
    const h = harness(p);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(() => launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL])).toThrow(
      'exercise budget'
    );
    expect(() =>
      launch(h.get, h.change, 'test', [fusion, direct], 'drivers', [FUSION_MODEL, direct.id])
    ).toThrow('individual models or Fusion');
    expect(fetcher).not.toHaveBeenCalled();
    expect(h.get().runs).toHaveLength(0);
  });
  it('runs the panel through Responses, applies only final JSON and reconciles confirmed cost', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(result())));
    vi.stubGlobal('fetch', fetcher);
    const h = harness();
    await launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]).done;
    const [url, options] = fetcher.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toMatch(/\/responses$/);
    expect(body.model).toBe(FUSION_MODEL);
    expect(body.tool_choice).toBe('required');
    expect(body.plugins).toMatchObject([
      {
        id: 'fusion',
        /*
        analysis_models: [
          '~anthropic/claude-opus-latest',
          '~openai/gpt-sol-latest',
          '~google/gemini-pro-latest'
        ],
        */
        reasoning: { effort: 'high' }
      }
    ]);
    expect(body.input[0].content).not.toContain('no web tools');
    expect(h.get().drivers).toHaveLength(1);
    expect(h.get().runs[0]).toMatchObject({
      status: 'succeeded',
      modelId: FUSION_MODEL,
      resolvedModelId: 'resolved/outer',
      fusionInvoked: true,
      costBasis: 'allowance',
      estimated: 5,
      confirmed: 0.15,
      unknownCharge: false
    });
    expect(reserved(h.get())).toBe(0);
    expect(uncertainSpend(h.get())).toBe(0);
    const backup = projectJSON(h.get());
    expect(backup).not.toContain('Bearer');
    expect(parseProject(JSON.parse(backup)).runs).toEqual(h.get().runs);
  });
  it('reconciles malformed results and retries against the current exercise budget', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(result(0.2, 'not JSON'))))
      );
    vi.stubGlobal('fetch', fetcher);
    const h = harness();
    await launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]).done;
    const run = h.get().runs[0];
    expect(run.status).toBe('failed');
    expect(run.rawOutput).toBe('not JSON');
    expect(run.confirmed).toBe(0.2);
    expect(h.get().drivers).toHaveLength(0);
    expect(
      planRequests(h.get(), [fusion], 'drivers', [FUSION_MODEL], undefined, run.id).estimatedTotal
    ).toBe(4.8);
    h.get().budget = 8;
    expect(
      planRequests(h.get(), [fusion], 'drivers', [FUSION_MODEL], undefined, run.id).estimatedTotal
    ).toBe(7.8);
  });
  it('retains the budget reservation when successful work has no reported charge', async () => {
    const response = result();
    delete response.usage.cost;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(response))));
    const h = harness();
    await launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]).done;
    expect(h.get().runs[0].confirmed).toBeNull();
    expect(uncertainSpend(h.get())).toBe(5);
    expect(remainingBudget(h.get())).toBe(0);
    expect(() => launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL])).toThrow(
      'exercise budget'
    );
  });
  it('keeps possible charges for dispatched cancellation and timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError'))
            )
          )
      )
    );
    const h = harness();
    const operation = launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]);
    expect(reserved(h.get())).toBe(5);
    await vi.advanceTimersByTimeAsync(599999);
    expect(h.get().runs[0].status).toBe('running');
    await vi.advanceTimersByTimeAsync(1);
    await operation.done;
    expect(h.get().runs[0].status).toBe('failed');
    expect(uncertainSpend(h.get())).toBe(5);
    h.get().budget = 6;
    const next = launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]);
    next.cancel();
    await next.done;
    expect(h.get().runs.at(-1)?.status).toBe('cancelled');
    expect(uncertainSpend(h.get())).toBe(6);
  });
  it('accounts for confirmed, reserved and unknown charges from all models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(result(0.2)))));
    const h = harness();
    await launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]).done;
    const saved = h.get().runs[0];
    h.get().runs.push(
      {
        ...saved,
        id: 'queued-direct',
        modelId: direct.id,
        status: 'queued',
        confirmed: null,
        estimated: 0.3
      },
      {
        ...saved,
        id: 'unknown-direct',
        modelId: direct.id,
        status: 'failed',
        confirmed: null,
        estimated: 0.4,
        unknownCharge: true
      }
    );
    const plan = planRequests(h.get(), [fusion], 'drivers', [FUSION_MODEL]);
    expect(plan.estimatedTotal).toBeCloseTo(4.1);
    expect(canSpend(h.get(), plan.estimatedTotal!)).toBe(true);
    expect(canSpend(h.get(), plan.estimatedTotal! + 0.01)).toBe(false);
  });
  it('releases unused budget for subsequent Fusion runs and blocks after overspending', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(result(0.15))))
      .mockResolvedValueOnce(new Response(JSON.stringify(result(5))));
    vi.stubGlobal('fetch', fetcher);
    const h = harness();
    await launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]).done;
    expect(remainingBudget(h.get())).toBe(4.85);
    const next = launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]);
    expect(reserved(h.get())).toBe(4.85);
    await next.done;
    expect(spent(h.get())).toBe(5.15);
    expect(remainingBudget(h.get())).toBe(0);
    expect(() => launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL])).toThrow(
      'exercise budget'
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('never accepts a direct answer as a completed Fusion consultation', async () => {
    const response = result();
    response.output = response.output.filter((v) => v.type === 'message');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(response))));
    const h = harness();
    await launch(h.get, h.change, 'test', [fusion], 'drivers', [FUSION_MODEL]).done;
    expect(h.get().runs[0].status).toBe('failed');
    expect(h.get().drivers).toHaveLength(0);
    expect(
      fusionCompletion({
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' }
      }).choices?.[0].finish_reason
    ).toBe('length');
  });
});

describe('direct reasoning requests', () => {
  it('sends the advertised effort, includes reasoning in estimates and freezes retry preferences', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'resolved/text',
          choices: [{ message: { content: 'bad JSON' } }],
          usage: { cost: 0.01 }
        })
      )
    );
    vi.stubGlobal('fetch', fetcher);
    const h = harness();
    const plan = planRequests(h.get(), [direct], 'drivers', [direct.id]);
    expect(plan.requests[0].maxOutputTokens).toBe(30000);
    await launch(h.get, h.change, 'test', [direct], 'drivers', [direct.id]).done;
    expect(JSON.parse(fetcher.mock.calls[0][1].body).reasoning).toEqual({ effort: 'high' });
    const saved = h.get().runs[0];
    h.get().reasoningEfforts[direct.id] = 'low';
    expect(
      planRequests(h.get(), [direct], 'drivers', [direct.id], undefined, saved.id).requests[0]
        .reasoningEffort
    ).toBe('high');
    expect(
      planRequests(
        h.get(),
        [direct],
        'drivers',
        [direct.id],
        undefined,
        saved.id,
        undefined,
        undefined,
        { reasoningEfforts: { [direct.id]: 'low' } }
      ).requests[0].reasoningEffort
    ).toBe('low');
    expect(saved.resolvedModelId).toBe('resolved/text');
  });
  it('runs a verified free model with a key even after paid budget is exhausted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(proposal) } }],
            usage: { cost: 0 }
          })
        )
      )
    );
    const p = newProject();
    p.budget = 0.001;
    const h = harness(p);
    const free = { ...direct, pricing: { prompt: '0', completion: '0' } };
    await launch(h.get, h.change, 'no-paid-credit', [free], 'drivers', [free.id]).done;
    expect(h.get().runs[0].status).toBe('succeeded');
    expect(h.get().runs[0].estimated).toBe(0);
  });
});
