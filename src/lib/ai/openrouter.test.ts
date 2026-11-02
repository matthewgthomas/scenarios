import { describe, it, expect, vi, afterEach } from 'vitest';
import { exampleProject } from '$lib/domain/example';
import { newProject, type Project, type Run } from '$lib/domain/project';
import { launch, applyOutput, contextFor, estimate, type Model } from './openrouter';

const models: Model[] = ['one/a', 'two/b', 'three/c'].map((id) => ({
  id,
  name: id,
  context_length: 128000,
  pricing: { prompt: '0.000001', completion: '0.000002' },
  supported_parameters: ['response_format']
}));
const response = (output: unknown, cost: number | undefined = 0.002) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(output) } }],
      usage: { cost, prompt_tokens: 120, completion_tokens: 80 }
    }),
    { status: 200 }
  );
const proposal = (title: string) => ({
  drivers: [{ title, summary: 'A possible driver of humanitarian change.', tags: ['Social'] }]
});
function harness(initial?: Project) {
  let p = initial ?? newProject();
  p.question = 'How could access to essentials evolve?';
  p.horizon = '2029';
  return {
    get: () => p,
    change: (fn: (p: Project) => void) => {
      const next = structuredClone(p);
      fn(next);
      next.revision++;
      p = next;
    }
  };
}
afterEach(() => vi.unstubAllGlobals());

describe('independent OpenRouter orchestration', () => {
  it('sends the same context independently, uses exact IDs, and never enables research tools', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi
      .fn()
      .mockImplementation((_url, options) => response(proposal(JSON.parse(options.body).model)));
    vi.stubGlobal('fetch', fetcher);
    const h = harness();
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'drivers',
      models.map((m) => m.id)
    ).done;
    const bodies = fetcher.mock.calls.map((call) => JSON.parse(call[1].body));
    expect(bodies.map((b) => b.model).sort()).toEqual(models.map((m) => m.id).sort());
    expect(new Set(bodies.map((b) => b.messages[1].content)).size).toBe(1);
    expect(bodies.every((b) => !b.tools && !b.plugins && !b.models)).toBe(true);
    expect(h.get().runs.every((r) => r.status === 'succeeded')).toBe(true);
    expect(h.get().drivers).toHaveLength(3);
    expect(JSON.stringify(h.get())).not.toContain('test-key');
  });
  it('retains two successful contributions when the third fails and retries only that model', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    let fail = true;
    const fetcher = vi.fn().mockImplementation((_url, options) => {
      const model = JSON.parse(options.body).model;
      return model === models[2].id && fail
        ? new Response('', { status: 402 })
        : response(proposal(model));
    });
    vi.stubGlobal('fetch', fetcher);
    const h = harness();
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'drivers',
      models.map((m) => m.id)
    ).done;
    expect(h.get().drivers).toHaveLength(2);
    const failed = h.get().runs.find((r) => r.status === 'failed')!;
    expect(failed.error).toContain('credit');
    fail = false;
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'drivers',
      [failed.modelId],
      undefined,
      failed.id
    ).done;
    expect(h.get().drivers).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(h.get().runs.at(-1)?.retryOf).toBe(failed.id);
  });
  it('blocks an over-budget batch before dispatch and preserves existing work', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const initial = exampleProject();
    initial.budget = 0.000001;
    const h = harness(initial);
    expect(() =>
      launch(
        h.get,
        h.change,
        'test-key',
        models,
        'drivers',
        models.map((m) => m.id)
      )
    ).toThrow('budget');
    expect(fetcher).not.toHaveBeenCalled();
    expect(h.get().drivers).toHaveLength(8);
    expect(h.get().runs).toHaveLength(0);
  });
  it('retains malformed response data without inventing results or making automatic repair calls', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi.fn().mockResolvedValue(response({ drivers: [{ title: 'Invalid' }] }));
    vi.stubGlobal('fetch', fetcher);
    const h = harness();
    await launch(h.get, h.change, 'test-key', models, 'drivers', [models[0].id]).done;
    expect(h.get().runs[0].status).toBe('failed');
    expect(h.get().runs[0].output).toBeDefined();
    expect(h.get().drivers).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves a response but does not apply it when analyst inputs changed mid-flight', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    let resolve!: (r: Response) => void;
    vi.stubGlobal('fetch', () => new Promise<Response>((r) => (resolve = r)));
    const h = harness();
    const op = launch(h.get, h.change, 'test-key', models, 'drivers', [models[0].id]);
    h.change((p) => (p.horizon = '2040'));
    resolve(response(proposal('Driver')));
    await op.done;
    expect(h.get().drivers).toHaveLength(0);
    expect(h.get().runs[0].error).toContain('Inputs changed');
    expect(h.get().runs[0].output).toBeDefined();
  });
  it('keeps consolidation scope stable when the analyst navigates to another stage', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', () => new Promise<Response>((done) => (resolve = done)));
    const initial = exampleProject();
    initial.stage = 1;
    const h = harness(initial);
    const op = launch(h.get, h.change, 'test-key', models, 'consolidate', [models[0].id]);
    h.change((p) => (p.stage = 4));
    resolve(response({ groups: [] }));
    await op.done;
    expect(h.get().runs[0].status).toBe('succeeded');
    expect(h.get().stage).toBe(4);
  });
  it('does not start queued work after cancellation', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi
      .fn()
      .mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener('abort', () => reject(new Error('aborted')))
          )
      );
    vi.stubGlobal('fetch', fetcher);
    const h = harness();
    const op = launch(
      h.get,
      h.change,
      'test-key',
      models,
      'drivers',
      models.map((m) => m.id)
    );
    op.cancel();
    await op.done;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(h.get().runs.every((r) => r.status === 'cancelled')).toBe(true);
    expect(h.get().runs[2].unknownCharge).toBe(false);
  });
  it('records unknown returned costs separately and requires live prices for admission', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(proposal('Driver'), undefined)));
    const h = harness();
    // An explicit missing usage cost, rather than a zero cost.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(proposal('Driver')) } }],
            usage: {}
          })
        )
      )
    );
    await launch(h.get, h.change, 'test-key', models, 'drivers', [models[0].id]).done;
    expect(h.get().runs[0].confirmed).toBeNull();
    expect(h.get().runs[0].unknownCharge).toBe(true);
    expect(estimate(undefined, {}, 'drivers')).toBeNull();
  });
});

describe('structured analytical responses', () => {
  const makeRun = (p: Project, task: Run['task'], modelId = 'one/a'): Run => ({
    id: 'run',
    operationId: 'op',
    exerciseId: p.id,
    stage: 2,
    task,
    modelId,
    promptTemplateVersion: 'quick-1',
    inputRevision: p.revision,
    status: 'running',
    at: '2026-11-02',
    estimated: 0.01,
    confirmed: null,
    unknownCharge: true,
    context: contextFor(p, task),
    targetIds: []
  });
  it('flags missing rating cells while preserving valid positions', () => {
    const p = exampleProject();
    p.drivers.forEach((d) => {
      d.ratings = [];
      d.decision = undefined;
    });
    const message = applyOutput(p, makeRun(p, 'ratings'), {
      ratings: [
        {
          driverId: p.drivers[0].id,
          impact: 5,
          uncertainty: 4,
          rationale: 'Consequences for essential needs.'
        }
      ]
    });
    expect(message).toContain('Missing');
    expect(p.drivers[0].ratings).toHaveLength(1);
    expect(p.drivers[1].ratings).toHaveLength(0);
  });
  it('rejects out-of-range ratings instead of coercing them', () => {
    const p = exampleProject();
    expect(() =>
      applyOutput(p, makeRun(p, 'ratings'), {
        ratings: [{ driverId: p.drivers[0].id, impact: 6, uncertainty: 4, rationale: 'Invalid' }]
      })
    ).toThrow();
  });
  it('requires exact hypothesis references in chain construction', () => {
    const p = exampleProject();
    const chain = {
      title: 'Invalid chain',
      kind: 'main',
      items: p.drivers
        .filter((d) => d.selected)
        .map((d) => ({ driverId: d.id, hypothesisId: 'invented' })),
      reasoning: 'Reason',
      tensions: [],
      assumptions: [],
      distinctiveness: 'Different',
      novelDrivers: []
    };
    expect(() => applyOutput(p, makeRun(p, 'chains'), { chains: [chain] })).toThrow('references');
    expect(p.chains).toHaveLength(3);
  });
  it('preserves novel wildcard drivers as unscored, unapproved proposals', () => {
    const p = exampleProject();
    const items = p.drivers
      .filter((d) => d.selected)
      .map((d) => ({ driverId: d.id, hypothesisId: null }));
    applyOutput(p, makeRun(p, 'chains'), {
      chains: [
        {
          title: 'A disruption',
          kind: 'wildcard',
          items,
          reasoning: 'Causal rationale',
          tensions: [],
          assumptions: [],
          distinctiveness: 'Different',
          novelDrivers: [
            {
              title: 'Novel disruption',
              summary: 'A plausible disruption',
              assessment: 'Plausible mechanism, humanitarian significance and interactions.'
            }
          ]
        }
      ]
    });
    const d = p.drivers.at(-1)!;
    expect(d.origin).toBe('wildcard');
    expect(d.approved).toBe(false);
    expect(d.ratings).toEqual([]);
    expect(d.decision).toBeUndefined();
  });
  it('keeps semantic consolidation advisory and preserves independent contributions', () => {
    const p = exampleProject();
    p.stage = 1;
    const original = JSON.stringify(p.drivers);
    applyOutput(p, makeRun(p, 'consolidate'), {
      groups: [
        {
          entityIds: [p.drivers[0].id, p.drivers[1].id],
          title: 'Potential overlap',
          reason: 'Analyst must review this suggestion.'
        }
      ]
    });
    expect(JSON.stringify(p.drivers)).toBe(original);
    expect(p.mergeSuggestions).toHaveLength(1);
    expect(p.mergeSuggestions[0].status).toBe('pending');
  });
  it('rejects consolidation of future states from different uncertainties', () => {
    const p = exampleProject();
    p.stage = 4;
    expect(() =>
      applyOutput(p, makeRun(p, 'consolidate'), {
        groups: [
          {
            entityIds: [p.hypotheses[0].id, p.hypotheses[3].id],
            title: 'Invalid merge',
            reason: 'Different uncertainties'
          }
        ]
      })
    ).toThrow('Invalid consolidation');
    expect(p.mergeSuggestions).toHaveLength(0);
  });
});
