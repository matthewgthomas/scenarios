import { describe, it, expect, vi, afterEach } from 'vitest';
import { exampleProject } from '$lib/domain/example';
import { newProject, reserved, type Project, type Run } from '$lib/domain/project';
import { mergeResults } from '$lib/domain/task-results';
import {
  launch,
  applyOutput,
  contextFor,
  estimate,
  planRequests,
  responseText,
  type Model,
  type Task
} from './openrouter';

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
function ratingProject(count: number): Project {
  const p = newProject();
  const template = exampleProject().drivers[0];
  p.stage = 2;
  p.drivers = Array.from({ length: count }, (_, i) => ({
    ...structuredClone(template),
    id: `driver_${i}`,
    title: `Driver ${i}`,
    ratings: [],
    decision: undefined,
    approved: true
  }));
  return p;
}
const scores = (ids: string[]) => ({
  ratings: ids.map((driverId) => ({
    driverId,
    impact: 4,
    uncertainty: 3,
    rationale: 'Specific impact.'
  }))
});
const requestIds = (body: string): string[] => {
  const message = JSON.parse(body).messages[1].content;
  return JSON.parse(message.split('\nANALYST CONTEXT:\n')[1]).drivers.map(
    (d: { id: string }) => d.id
  );
};
const rawResponse = (
  content: string | null,
  finishReason = 'stop',
  extra: Record<string, unknown> = {}
) =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: { content },
          finish_reason: finishReason,
          native_finish_reason: 'provider_stop',
          ...extra
        }
      ],
      usage: { cost: 0.003, prompt_tokens: 150, completion_tokens: 6000 }
    })
  );
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

describe('batched driver assessments', () => {
  it.each([0, 10, 11, 44])('plans complete, bounded coverage for %i approved drivers', (count) => {
    const p = ratingProject(count);
    const plan = planRequests(
      p,
      models,
      'ratings',
      models.map((m) => m.id)
    );
    expect(plan.requests).toHaveLength(Math.ceil(count / 10) * models.length);
    for (const model of models) {
      const requests = plan.requests.filter((r) => r.modelId === model.id);
      expect(requests.flatMap((r) => r.targetIds)).toEqual(p.drivers.map((d) => d.id));
      expect(requests.every((r) => r.targetIds.length <= 10 && r.maxOutputTokens === 6000)).toBe(
        true
      );
    }
    expect(plan.estimatedTotal).toBe(plan.requests.reduce((sum, r) => sum + r.estimated!, 0));
  });

  it('does not dispatch an assessment with no approved drivers', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const h = harness(ratingProject(0));
    expect(() => launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id])).toThrow(
      'No missing ratings'
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(h.get().runs).toHaveLength(0);
  });

  it('collects all 44 ratings from each model using identical independent batch contexts', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi
      .fn()
      .mockImplementation((_url, options) => response(scores(requestIds(options.body))));
    vi.stubGlobal('fetch', fetcher);
    const h = harness(ratingProject(44));
    const plan = planRequests(
      h.get(),
      models,
      'ratings',
      models.map((m) => m.id)
    );
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'ratings',
      models.map((m) => m.id)
    ).done;
    expect(fetcher).toHaveBeenCalledTimes(15);
    const bodies = fetcher.mock.calls.map((call) => JSON.parse(call[1].body));
    const first = bodies.filter((b) => b.model === models[0].id).map((b) => b.messages);
    for (const model of models) {
      expect(bodies.filter((b) => b.model === model.id).map((b) => b.messages)).toEqual(first);
    }
    expect(bodies.every((b) => b.max_tokens === 6000 && !b.tools && !b.plugins && !b.models)).toBe(
      true
    );
    expect(
      h.get().runs.every((r) => r.status === 'succeeded' && r.promptTemplateVersion === 'quick-2')
    ).toBe(true);
    expect(h.get().runs.reduce((sum, r) => sum + r.estimated, 0)).toBe(plan.estimatedTotal);
    for (const d of h.get().drivers) {
      expect(d.ratings.map((r) => r.modelId)).toEqual(models.map((m) => m.id));
      for (const rating of d.ratings) {
        const run = h.get().runs.find((r) => r.id === rating.runId)!;
        expect(run.targetIds).toContain(d.id);
        expect(rating.driverRevision).toBe(d.revision);
      }
    }
  });

  it('reserves the full plan, commits batches immediately, and cancels with at most two requests in flight', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const h = harness(ratingProject(44));
    const plan = planRequests(h.get(), models, 'ratings', [models[0].id]);
    const pending: { ids: string[]; resolve: (r: Response) => void }[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const fetcher = vi.fn().mockImplementation((_url, options) => {
      expect(reserved(h.get())).toBeGreaterThan(0);
      if (!pending.length) expect(reserved(h.get())).toBe(plan.estimatedTotal);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<Response>((resolve, reject) => {
        pending.push({
          ids: requestIds(options.body),
          resolve: (r) => {
            inFlight--;
            resolve(r);
          }
        });
        options.signal.addEventListener('abort', () => {
          inFlight--;
          reject(new Error('aborted'));
        });
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const op = launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    pending[0].resolve(response(scores(pending[0].ids)));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(h.get().drivers.filter((d) => d.ratings.length)).toHaveLength(10);
    op.cancel();
    await op.done;
    expect(maxInFlight).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(h.get().runs.map((r) => r.status)).toEqual([
      'succeeded',
      'cancelled',
      'cancelled',
      'cancelled',
      'cancelled'
    ]);
    expect(
      h
        .get()
        .runs.slice(3)
        .every((r) => !r.unknownCharge)
    ).toBe(true);
    expect(reserved(h.get())).toBe(0);
  });

  it('rejects a budget that covers one request but cannot cover the entire assessment', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const p = ratingProject(44);
    const plan = planRequests(p, models, 'ratings', [models[0].id]);
    p.budget = plan.requests[0].estimated! + 0.000001;
    const h = harness(p);
    expect(() => launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id])).toThrow(
      'budget'
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(h.get().runs).toHaveLength(0);
  });

  it('aborts cancellation during response downloading and never applies a late response', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    let reading = 0;
    let aborted = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, options) =>
        Promise.resolve({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              reading++;
              options.signal.addEventListener('abort', () => {
                aborted++;
                reject(new Error('aborted body'));
              });
            })
        })
      )
    );
    const h = harness(ratingProject(11));
    const op = launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id]);
    await vi.waitFor(() => expect(reading).toBe(2));
    op.cancel();
    await op.done;
    expect(aborted).toBe(2);
    expect(h.get().drivers.every((d) => !d.ratings.length)).toBe(true);
    expect(h.get().runs.every((r) => r.status === 'cancelled' && r.unknownCharge)).toBe(true);
  });

  it('preserves valid partial batches and retries only missing cells inside that batch for the chosen model', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    let partial = true;
    const fetcher = vi.fn().mockImplementation((_url, options) => {
      const ids = requestIds(options.body);
      return response(scores(partial && ids.includes('driver_0') ? ids.slice(0, 2) : ids));
    });
    vi.stubGlobal('fetch', fetcher);
    const h = harness(ratingProject(11));
    await launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id]).done;
    const failed = h.get().runs.find((r) => r.status === 'failed')!;
    expect(failed.error).toContain('Missing scores for 8');
    expect(h.get().drivers[10].ratings).toHaveLength(1);
    const ownPlan = planRequests(h.get(), models, 'ratings', [models[0].id], undefined, failed.id);
    expect(ownPlan.requests.flatMap((r) => r.targetIds)).toEqual(failed.targetIds.slice(2));
    const replacementPlan = planRequests(
      h.get(),
      models,
      'ratings',
      [models[1].id],
      undefined,
      failed.id
    );
    expect(replacementPlan.requests.flatMap((r) => r.targetIds)).toEqual(failed.targetIds);
    // A replacement's existing cells must also be excluded from its new estimate and request.
    h.change((p) =>
      p.drivers[3].ratings.push({ ...p.drivers[0].ratings[0], modelId: models[1].id })
    );
    const revised = planRequests(h.get(), models, 'ratings', [models[1].id], undefined, failed.id);
    expect(revised.requests[0].targetIds).not.toContain('driver_3');
    partial = false;
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'ratings',
      [models[0].id],
      undefined,
      failed.id
    ).done;
    expect(requestIds(fetcher.mock.calls.at(-1)![1].body)).toEqual(failed.targetIds.slice(2));
    expect(h.get().drivers.every((d) => d.ratings.some((r) => r.modelId === models[0].id))).toBe(
      true
    );
    expect(h.get().runs.at(-1)?.retryOf).toBe(failed.id);
    expect(
      planRequests(h.get(), models, 'ratings', [models[0].id], undefined, failed.id).requests
    ).toHaveLength(0);
    expect(() =>
      launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id], undefined, failed.id)
    ).toThrow('No missing ratings');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('retries legacy full-assessment records using their saved scope and current driver revisions', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, options) => response(scores(requestIds(options.body))))
    );
    const h = harness(ratingProject(11));
    await launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id]).done;
    const old = structuredClone(h.get().runs[0]);
    old.id = 'legacy';
    old.promptTemplateVersion = 'quick-1';
    old.targetIds = [];
    old.context = contextFor(h.get(), 'ratings');
    delete old.batchIndex;
    delete old.batchCount;
    h.change((p) => {
      p.runs.push(old);
      p.drivers[5].revision++;
    });
    expect(
      planRequests(h.get(), models, 'ratings', [models[0].id], undefined, old.id).requests[0]
        .targetIds
    ).toEqual(['driver_5']);
  });

  it('rejects results for changed batch inputs without discarding other completed batches', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const pending: { ids: string[]; resolve: (r: Response) => void }[] = [];
    vi.stubGlobal(
      'fetch',
      (_url: string, options: { body: string }) =>
        new Promise<Response>((resolve) => pending.push({ ids: requestIds(options.body), resolve }))
    );
    const h = harness(ratingProject(11));
    const op = launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id]);
    pending[1].resolve(response(scores(pending[1].ids)));
    await vi.waitFor(() => expect(h.get().drivers[10].ratings).toHaveLength(1));
    h.change((p) => {
      p.drivers[0].summary = 'Changed input';
      p.drivers[0].revision++;
    });
    pending[0].resolve(response(scores(pending[0].ids)));
    await op.done;
    expect(h.get().runs[0].error).toContain('Inputs changed');
    expect(h.get().runs[0].rawOutput).toBeDefined();
    expect(h.get().drivers.filter((d) => d.ratings.length)).toHaveLength(1);
  });
});

describe('response diagnostics and structured output', () => {
  it.each([
    {
      content: '{"ratings":[{"rationale":"',
      reason: 'length',
      error: 'Response stopped at the output limit'
    },
    { content: '', reason: 'length', error: 'Response stopped at the output limit' },
    { content: null, reason: 'length', error: 'Response stopped at the output limit' },
    { content: '{"ratings":[', reason: 'stop', error: 'malformed JSON' },
    {
      content:
        '{"ratings":[{"driverId":"driver_0","impact":6,"uncertainty":3,"rationale":"Invalid"}]}',
      reason: 'stop',
      error: 'ratings.0.impact'
    },
    { content: null, reason: 'content_filter', error: 'provider filtered' },
    { content: null, reason: 'error', error: 'generation error' }
  ])(
    'reports $reason / $error and retains diagnostic and charge data',
    async ({ content, reason, error }) => {
      vi.stubGlobal('navigator', { onLine: true });
      const fetcher = vi.fn().mockResolvedValue(rawResponse(content, reason));
      vi.stubGlobal('fetch', fetcher);
      const h = harness(ratingProject(1));
      await launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id]).done;
      const run = h.get().runs[0];
      expect(run.status).toBe('failed');
      expect(run.error).toContain(error);
      expect(run.finishReason).toBe(reason);
      expect(run.nativeFinishReason).toBe('provider_stop');
      expect(run.rawOutput).toBe(content ?? undefined);
      expect(run.confirmed).toBe(0.003);
      expect(run.unknownCharge).toBe(false);
      expect(run.inputTokens).toBe(150);
      expect(run.outputTokens).toBe(6000);
      expect(h.get().drivers[0].ratings).toHaveLength(0);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  );

  it('does not apply a duplicate or unexpected driver even after a valid rating', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    for (const driverId of ['driver_0', 'unexpected']) {
      const output = scores(['driver_0', driverId]);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(output)));
      const h = harness(ratingProject(2));
      await launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id]).done;
      expect(h.get().runs[0].error).toContain('Unexpected or duplicate');
      expect(h.get().drivers.every((d) => !d.ratings.length)).toBe(true);
    }
  });

  it('renders raw and legacy response strings without adding quotes or escapes', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const raw = '{"ratings":[\n{"rationale":"';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rawResponse(raw, 'length')));
    const h = harness(ratingProject(1));
    await launch(h.get, h.change, 'test-key', models, 'ratings', [models[0].id]).done;
    const run = h.get().runs[0];
    expect(responseText(run)).toBe(raw);
    expect(responseText({ ...run, rawOutput: undefined, output: raw })).toBe(raw);
    expect(responseText({ ...run, rawOutput: undefined, output: { ratings: [] } })).toBe(
      JSON.stringify({ ratings: [] }, null, 2)
    );
  });
});

describe.each<Task>([
  'consolidate',
  'drivers',
  'ratings',
  'hypotheses',
  'chains',
  'coherence',
  'narrative',
  'narrative_edit'
])('%s response formats', (task) => {
  it.each([
    { supported: ['response_format', 'structured_outputs'], format: 'json_schema' },
    { supported: ['structured_outputs'], format: 'json_schema' },
    { supported: ['response_format'], format: 'json_object' },
    { supported: [], format: undefined },
    { supported: undefined, format: undefined }
  ])('uses $format with capabilities $supported', async ({ supported, format }) => {
    vi.stubGlobal('navigator', { onLine: true });
    const catalogue = [{ ...models[0], supported_parameters: supported }];
    const p = exampleProject();
    p.mainCount = 1;
    p.wildcardCount = 0;
    const chain = p.chains[0];
    chain.approvedRevision = chain.revision;
    const outputs: Record<Task, Record<string, unknown>> = {
      consolidate: { groups: [] },
      drivers: proposal('A new driver'),
      ratings: scores(p.drivers.map((d) => d.id)),
      hypotheses: {
        hypotheses: p.drivers
          .filter((d) => d.selected)
          .map((d) => ({
            driverId: d.id,
            title: 'A new future state',
            description: 'A plausible alternative future.'
          }))
      },
      chains: {
        chains: [
          {
            title: 'A new chain',
            kind: 'main',
            items: p.drivers
              .filter((d) => d.selected)
              .map((d) => ({ driverId: d.id, hypothesisId: null })),
            reasoning: 'An unresolved alternative.',
            tensions: [],
            assumptions: [],
            distinctiveness: 'Preserves uncertainty.',
            novelDrivers: []
          }
        ]
      },
      coherence: {
        checks: [
          { chainId: chain.id, reasoning: 'Compatible states.', tensions: [], assumptions: [] }
        ]
      },
      narrative: { chainId: chain.id, text: 'A possible future.' },
      narrative_edit: { chainId: chain.id, text: 'A clearer possible future.' }
    };
    const output = outputs[task];
    const fetcher = vi.fn().mockResolvedValue(response(output));
    vi.stubGlobal('fetch', fetcher);
    const h = harness(p);
    const targets =
      task === 'coherence' || task === 'narrative' || task === 'narrative_edit'
        ? [chain.id]
        : undefined;
    await launch(h.get, h.change, 'test-key', catalogue, task, [models[0].id], targets).done;
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.response_format?.type).toBe(format);
    if (format === 'json_schema') {
      expect(body.provider).toEqual({ require_parameters: true });
      const { name, strict, schema } = body.response_format.json_schema;
      expect(name).toBe(task);
      expect(strict).toBe(true);
      expect(schema.type).toBe('object');
      expect(schema.additionalProperties).toBe(false);
      expect(Object.keys(schema.properties).sort()).toEqual(Object.keys(output).sort());
      expect(schema.required.sort()).toEqual(Object.keys(output).sort());
      if (task !== 'narrative' && task !== 'narrative_edit') {
        const list = schema.properties[Object.keys(output)[0]];
        expect(list.type).toBe('array');
        expect(list.items.additionalProperties).toBe(false);
      }
    } else expect(body.provider).toBeUndefined();
    expect(h.get().runs[0].status).toBe('succeeded');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('chain construction batches', () => {
  function project() {
    const p = exampleProject();
    p.chains = [];
    p.mainCount = 2;
    p.wildcardCount = 1;
    return p;
  }
  const inputFor = (body: string) =>
    JSON.parse(JSON.parse(body).messages[1].content.split('\nANALYST CONTEXT:\n')[1]);
  function chainsFor(input: ReturnType<typeof inputFor>) {
    return {
      chains: Array.from({ length: input.chainBatch.count }, (_, i) => ({
        title: `${input.chainBatch.kind} ${input.chainBatch.start + i}`,
        kind: input.chainBatch.kind,
        items: input.drivers.map((d: { id: string }) => ({
          driverId: d.id,
          hypothesisId:
            input.hypotheses.find((h: { driverId: string }) => h.driverId === d.id)?.id ?? null
        })),
        reasoning: 'Compatible future states with explicit interactions.',
        tensions: ['Response capacity may improve.'],
        assumptions: ['Current constraints persist.'],
        distinctiveness: 'A different combination of states.',
        novelDrivers: []
      }))
    };
  }

  it.each([
    [1, 0],
    [2, 1],
    [12, 6]
  ])('plans bounded independent portfolios for %i main / %i wildcard chains', (main, wildcards) => {
    const p = project();
    p.mainCount = main;
    p.wildcardCount = wildcards;
    const plan = planRequests(
      p,
      models,
      'chains',
      models.map((m) => m.id)
    );
    const first = plan.requests.filter((r) => r.modelId === models[0].id);
    expect(first).toHaveLength(Math.ceil(main / 3) + wildcards);
    for (const model of models) {
      const requests = plan.requests.filter((r) => r.modelId === model.id);
      expect(requests.map((r) => r.context)).toEqual(first.map((r) => r.context));
      for (const kind of ['main', 'wildcard']) {
        const batches = requests
          .map((r) => r.context.chainBatch as { kind: string; start: number; count: number })
          .filter((b) => b.kind === kind);
        expect(
          batches.flatMap((b) => Array.from({ length: b.count }, (_, i) => b.start + i))
        ).toEqual(Array.from({ length: kind === 'main' ? main : wildcards }, (_, i) => i + 1));
        expect(batches.every((b) => b.count <= (kind === 'main' ? 3 : 1))).toBe(true);
      }
      expect(
        requests.every((r) => r.maxOutputTokens >= 12000 && r.batchCount === requests.length)
      ).toBe(true);
      expect(requests.map((r) => r.batchIndex)).toEqual(requests.map((_, i) => i + 1));
    }
    expect(plan.estimatedTotal).toBe(plan.requests.reduce((sum, r) => sum + r.estimated!, 0));
  });

  it('sends complete coverage and only approved driver/hypothesis pairs in the strict schema', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const p = project();
    p.hypotheses[0].approved = false;
    p.hypotheses[1].archived = true;
    const catalogue = [{ ...models[0], supported_parameters: ['structured_outputs'] }];
    const fetcher = vi
      .fn()
      .mockImplementation((_url, options) => response(chainsFor(inputFor(options.body))));
    vi.stubGlobal('fetch', fetcher);
    const h = harness(p);
    const plan = planRequests(h.get(), catalogue, 'chains', [models[0].id]);
    await launch(h.get, h.change, 'test-key', catalogue, 'chains', [models[0].id]).done;
    expect(h.get().chains).toHaveLength(3);
    expect(
      h.get().runs.every((r) => r.status === 'succeeded' && r.promptTemplateVersion === 'quick-3')
    ).toBe(true);
    fetcher.mock.calls.forEach((call, i) => {
      const body = JSON.parse(call[1].body);
      const input = inputFor(call[1].body);
      const chains = body.response_format.json_schema.schema.properties.chains;
      expect(chains.minItems).toBe(input.chainBatch.count);
      expect(chains.maxItems).toBe(input.chainBatch.count);
      expect(chains.items.properties.kind.const).toBe(input.chainBatch.kind);
      const items = chains.items.properties.items;
      expect(items.minItems).toBe(input.drivers.length);
      expect(items.maxItems).toBe(input.drivers.length);
      expect(items.items.anyOf).toHaveLength(input.drivers.length);
      for (const pair of items.items.anyOf) {
        const driverId = pair.properties.driverId.const;
        const values = pair.properties.hypothesisId.anyOf;
        expect(values).toContainEqual({ type: 'null' });
        expect(values.find((v: { type: string }) => v.type === 'string').enum).toEqual(
          input.hypotheses
            .filter((h: { driverId: string }) => h.driverId === driverId)
            .map((h: { id: string }) => h.id)
        );
      }
      expect(JSON.stringify(body)).not.toContain(p.hypotheses[0].id);
      expect(JSON.stringify(body)).not.toContain(p.hypotheses[1].id);
      expect(body.max_tokens).toBe(plan.requests[i].maxOutputTokens);
      expect(h.get().runs[i].estimated).toBe(plan.requests[i].estimated);
    });
  });

  it('keeps valid main chains when a wildcard omits uncertainties, then retries only the wildcard', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi.fn().mockImplementation((_url, options) => {
      const input = inputFor(options.body);
      const output = chainsFor(input);
      if (input.chainBatch.kind === 'wildcard')
        output.chains[0].items = output.chains[0].items.slice(0, 2);
      return response(output);
    });
    vi.stubGlobal('fetch', fetcher);
    const h = harness(project());
    await launch(h.get, h.change, 'test-key', models, 'chains', [models[0].id]).done;
    const failed = h.get().runs.find((r) => r.status === 'failed')!;
    expect(h.get().chains).toHaveLength(2);
    expect(failed.error).toContain('Chain “wildcard 1”');
    expect(failed.error).toContain('missing uncertainties:');
    expect(failed.error).toContain('Work & incomes');
    expect(failed.rawOutput).toBeDefined();
    expect(failed.confirmed).toBe(0.002);
    const originalIds = h.get().chains.map((c) => c.id);
    const retryPlan = planRequests(h.get(), models, 'chains', [models[1].id], undefined, failed.id);
    expect(retryPlan.requests).toHaveLength(1);
    expect(retryPlan.requests[0].context.chainBatch).toEqual({
      kind: 'wildcard',
      start: 1,
      count: 1
    });
    fetcher.mockImplementation((_url, options) => response(chainsFor(inputFor(options.body))));
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'chains',
      [models[1].id],
      undefined,
      failed.id
    ).done;
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(h.get().chains).toHaveLength(3);
    expect(
      h
        .get()
        .chains.slice(0, 2)
        .map((c) => c.id)
    ).toEqual(originalIds);
    expect(h.get().runs.at(-1)?.retryOf).toBe(failed.id);
    expect(h.get().chains.at(-1)?.origins[0].modelId).toBe(models[1].id);
  });

  it('retains a truncated batch and charges, and increases its allowance only on explicit retry', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi.fn().mockImplementation((_url, options) => {
      const input = inputFor(options.body);
      return input.chainBatch.kind === 'wildcard'
        ? rawResponse('{"chains":[{"title":"Ice-free corridor shock"', 'length')
        : response(chainsFor(input));
    });
    vi.stubGlobal('fetch', fetcher);
    const h = harness(project());
    await launch(h.get, h.change, 'test-key', models, 'chains', [models[0].id]).done;
    const failed = h.get().runs.find((r) => r.status === 'failed')!;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(h.get().chains).toHaveLength(2);
    expect(failed.error).toContain('output limit');
    expect(failed.rawOutput).toContain('Ice-free corridor shock');
    expect(failed.confirmed).toBe(0.003);
    const retryPlan = planRequests(h.get(), models, 'chains', [models[0].id], undefined, failed.id);
    expect(retryPlan.requests).toHaveLength(1);
    expect(retryPlan.requests[0].maxOutputTokens).toBe(2 * failed.maxOutputTokens!);
    const limited = [{ ...models[0], top_provider: { max_completion_tokens: 18000 } }];
    const capped = planRequests(h.get(), limited, 'chains', [models[0].id], undefined, failed.id);
    expect(capped.requests[0].maxOutputTokens).toBe(18000);
    fetcher.mockImplementation((_url, options) => response(chainsFor(inputFor(options.body))));
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'chains',
      [models[0].id],
      undefined,
      failed.id
    ).done;
    expect(h.get().runs.at(-1)?.maxOutputTokens).toBe(retryPlan.requests[0].maxOutputTokens);
    expect(h.get().chains).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([
    'duplicate',
    'wrong driver',
    'unapproved',
    'unknown driver',
    'wrong count',
    'wrong kind'
  ])(
    'rejects %s references or batch shape without mutating or retrying the failed batch',
    async (problem) => {
      vi.stubGlobal('navigator', { onLine: true });
      const p = project();
      const unapproved = p.hypotheses.find((h) => h.driverId === p.drivers[0].id)!;
      unapproved.approved = false;
      const fetcher = vi.fn().mockImplementation((_url, options) => {
        const input = inputFor(options.body);
        const output = chainsFor(input);
        if (input.chainBatch.kind === 'main') {
          const chain = output.chains[0];
          if (problem === 'duplicate') chain.items[1] = chain.items[0];
          if (problem === 'wrong driver') chain.items[0].hypothesisId = chain.items[1].hypothesisId;
          if (problem === 'unapproved') chain.items[0].hypothesisId = unapproved.id;
          if (problem === 'unknown driver') chain.items[0].driverId = 'invented';
          if (problem === 'wrong count') output.chains.pop();
          if (problem === 'wrong kind') chain.kind = 'wildcard';
        }
        return response(output);
      });
      vi.stubGlobal('fetch', fetcher);
      const h = harness(p);
      await launch(h.get, h.change, 'test-key', models, 'chains', [models[0].id]).done;
      expect(h.get().runs[0].status).toBe('failed');
      expect(h.get().runs[0].rawOutput).toBeDefined();
      expect(h.get().runs[1].status).toBe('succeeded');
      expect(h.get().chains).toHaveLength(1);
      expect(h.get().chains[0].kind).toBe('wildcard');
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  );

  it('keeps explicit unresolved choices, including drivers with no approved hypotheses', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const p = project();
    p.hypotheses.filter((h) => h.driverId === p.drivers[0].id).forEach((h) => (h.approved = false));
    const fetcher = vi
      .fn()
      .mockImplementation((_url, options) => response(chainsFor(inputFor(options.body))));
    vi.stubGlobal('fetch', fetcher);
    const h = harness(p);
    await launch(h.get, h.change, 'test-key', models, 'chains', [models[0].id]).done;
    expect(h.get().runs.every((r) => r.status === 'succeeded')).toBe(true);
    expect(
      h
        .get()
        .chains.every(
          (c) => Object.hasOwn(c.items, p.drivers[0].id) && c.items[p.drivers[0].id] === null
        )
    ).toBe(true);
  });

  it('splits legacy portfolio retries into bounded batches', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rawResponse('{"chains":[', 'length')));
    const h = harness(project());
    await launch(h.get, h.change, 'test-key', models, 'chains', [models[0].id]).done;
    h.change((p) => {
      const run = p.runs[0];
      run.promptTemplateVersion = 'quick-1';
      run.context = contextFor(p, 'chains');
      delete run.maxOutputTokens;
      delete run.batchIndex;
      delete run.batchCount;
    });
    const failed = h.get().runs[0];
    const plan = planRequests(h.get(), models, 'chains', [models[0].id], undefined, failed.id);
    expect(plan.requests.map((r) => r.context.chainBatch)).toEqual([
      { kind: 'main', start: 1, count: 2 },
      { kind: 'wildcard', start: 1, count: 1 }
    ]);
  });

  it('reserves the complete chain operation before dispatch', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const p = project();
    const plan = planRequests(p, models, 'chains', [models[0].id]);
    p.budget = plan.requests[0].estimated!;
    const h = harness(p);
    expect(() => launch(h.get, h.change, 'test-key', models, 'chains', [models[0].id])).toThrow(
      'exceeds'
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects changed inputs while preserving completed batches', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const pending: { input: ReturnType<typeof inputFor>; resolve: (r: Response) => void }[] = [];
    vi.stubGlobal(
      'fetch',
      (_url: string, options: { body: string }) =>
        new Promise<Response>((resolve) => pending.push({ input: inputFor(options.body), resolve }))
    );
    const h = harness(project());
    const op = launch(h.get, h.change, 'test-key', models, 'chains', [models[0].id]);
    pending[0].resolve(response(chainsFor(pending[0].input)));
    await vi.waitFor(() => expect(h.get().chains).toHaveLength(2));
    h.change((p) => {
      p.hypotheses[0].description = 'An updated state';
    });
    pending[1].resolve(response(chainsFor(pending[1].input)));
    await op.done;
    expect(h.get().runs[1].error).toContain('Inputs changed');
    expect(h.get().chains).toHaveLength(2);
  });
});

describe('hypothesis response failures', () => {
  const catalogue = models.map((model) => ({
    ...model,
    supported_parameters: ['response_format', 'structured_outputs']
  }));
  const project = () => {
    const p = ratingProject(4);
    p.stage = 4;
    p.drivers.forEach((d) => (d.selected = true));
    return p;
  };
  const proposals = (ids: string[], modelId = models[0].id) => ({
    hypotheses: ids.flatMap((driverId) =>
      [1, 2].map((i) => ({
        driverId,
        title: `${modelId} future state ${i}`,
        description: 'A plausible alternative future.'
      }))
    )
  });
  const extraBraces = (output: ReturnType<typeof proposals>) =>
    `{"hypotheses":[${output.hypotheses.map((h) => `${JSON.stringify(h)}}`).join(',')}]}`;

  it('retains a redundant-brace response and its charges without repairing or retrying', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const h = harness(project());
    const raw = extraBraces(proposals(h.get().drivers.map((d) => d.id)));
    const fetcher = vi.fn().mockResolvedValue(rawResponse(raw));
    vi.stubGlobal('fetch', fetcher);
    await launch(h.get, h.change, 'test-key', catalogue, 'hypotheses', [models[0].id]).done;
    const run = h.get().runs[0];
    expect(run.status).toBe('failed');
    expect(run.error).toContain('malformed JSON');
    expect(run.error).toContain('retry explicitly');
    expect(run.rawOutput).toBe(raw);
    expect(run.output).toBe(raw);
    expect(responseText(run)).toBe(raw);
    expect(run.finishReason).toBe('stop');
    expect(run.nativeFinishReason).toBe('provider_stop');
    expect(run.confirmed).toBe(0.003);
    expect(run.unknownCharge).toBe(false);
    expect(run.inputTokens).toBe(150);
    expect(run.outputTokens).toBe(6000);
    expect(h.get().hypotheses).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves two successful contributions and explicitly retries only the malformed model', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    let fail = true;
    const fetcher = vi.fn().mockImplementation((_url, options) => {
      const { model } = JSON.parse(options.body);
      const output = proposals(requestIds(options.body), model);
      return model === models[2].id && fail ? rawResponse(extraBraces(output)) : response(output);
    });
    vi.stubGlobal('fetch', fetcher);
    const h = harness(project());
    await launch(
      h.get,
      h.change,
      'test-key',
      catalogue,
      'hypotheses',
      models.map((m) => m.id)
    ).done;
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(h.get().runs.filter((r) => r.status === 'succeeded')).toHaveLength(2);
    expect(h.get().hypotheses).toHaveLength(16);
    const successful = structuredClone(h.get().hypotheses);
    const failed = structuredClone(h.get().runs.find((r) => r.status === 'failed')!);
    expect(failed.modelId).toBe(models[2].id);
    expect(failed.error).toContain('malformed JSON');
    expect(h.get().runs.reduce((sum, r) => sum + r.confirmed!, 0)).toBeCloseTo(0.007);

    fail = false;
    await launch(
      h.get,
      h.change,
      'test-key',
      catalogue,
      'hypotheses',
      [failed.modelId],
      undefined,
      failed.id
    ).done;
    expect(fetcher).toHaveBeenCalledTimes(4);
    const retryBody = JSON.parse(fetcher.mock.calls[3][1].body);
    const originalBody = JSON.parse(
      fetcher.mock.calls.find((call) => JSON.parse(call[1].body).model === failed.modelId)![1].body
    );
    expect(retryBody.model).toBe(failed.modelId);
    expect(retryBody.messages).toEqual(originalBody.messages);
    expect(h.get().runs.at(-1)).toMatchObject({
      status: 'succeeded',
      modelId: failed.modelId,
      retryOf: failed.id
    });
    expect(h.get().runs.find((r) => r.id === failed.id)).toEqual(failed);
    expect(h.get().hypotheses).toHaveLength(24);
    for (const hypothesis of successful)
      expect(h.get().hypotheses.find((h) => h.id === hypothesis.id)).toEqual(hypothesis);
    for (const hypothesis of h.get().hypotheses) {
      const origin = hypothesis.origins[0];
      const run = h.get().runs.find((r) => r.id === origin.runId)!;
      expect(run.status).toBe('succeeded');
      expect(run.modelId).toBe(origin.modelId);
    }
    expect(h.get().runs.reduce((sum, r) => sum + r.confirmed!, 0)).toBeCloseTo(0.009);
  });

  it.each([
    { invalid: 'schema', error: 'hypotheses.2.description' },
    { invalid: 'driver', error: 'unexpected driver' }
  ])(
    'rejects an invalid $invalid without committing earlier valid hypotheses',
    async ({ invalid, error }) => {
      vi.stubGlobal('navigator', { onLine: true });
      const p = exampleProject();
      p.stage = 4;
      const original = structuredClone(p);
      const existing = p.hypotheses[0];
      const output = {
        hypotheses: [
          {
            driverId: existing.driverId,
            title: existing.title,
            description: 'Another contribution.'
          },
          {
            driverId: existing.driverId,
            title: 'A new future state',
            description: 'A valid state.'
          },
          {
            driverId: invalid === 'driver' ? 'unexpected' : existing.driverId,
            title: 'An invalid future state',
            description: invalid === 'schema' ? '' : 'An unknown reference.'
          }
        ]
      };
      const raw = JSON.stringify(output);
      const fetcher = vi.fn().mockResolvedValue(rawResponse(raw));
      vi.stubGlobal('fetch', fetcher);
      const h = harness(p);
      await launch(h.get, h.change, 'test-key', catalogue, 'hypotheses', [models[0].id]).done;
      expect(h.get().runs[0].status).toBe('failed');
      expect(h.get().runs[0].error).toContain(error);
      expect(h.get().runs[0].rawOutput).toBe(raw);
      expect(h.get().runs[0].output).toEqual(output);
      expect(h.get().hypotheses).toEqual(original.hypotheses);
      expect(h.get().drivers).toEqual(original.drivers);
      expect(h.get().chains).toEqual(original.chains);
      expect(h.get().narratives).toEqual(original.narratives);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  );
});

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
  it.each([true, false])(
    'reviews newly added broad/narrow chocolate drivers and preserves the model decision (suggested: %s)',
    async (suggested) => {
      vi.stubGlobal('navigator', { onLine: true });
      const p = newProject();
      p.stage = 1;
      const template = exampleProject().drivers[0];
      p.drivers = ['price of chocolate', 'price of white chocolate'].map((title, i) => ({
        ...structuredClone(template),
        id: `chocolate-${i}`,
        title,
        summary: '',
        origin: 'user',
        origins: [],
        ratings: [],
        decision: undefined,
        approved: false,
        selected: false
      }));
      p.drivers.push({ ...structuredClone(p.drivers[0]), id: 'archived', archived: true });
      const before = JSON.stringify(p.drivers);
      const fetcher = vi.fn().mockImplementation((_url, options) => {
        const body = JSON.parse(options.body);
        const instruction = body.messages[1].content;
        const context = JSON.parse(instruction.split('\nANALYST CONTEXT:\n')[1]);
        expect(body.model).toBe(models[0].id);
        expect(context.kind).toBe('driver');
        expect(context.records).toEqual(
          p.drivers.slice(0, 2).map((driver) => ({
            id: driver.id,
            title: driver.title,
            description: '',
            revision: driver.revision
          }))
        );
        expect(instruction).toContain('redundant broader/narrower variants');
        expect(instruction).toContain('a shared theme alone is not enough to merge');
        expect(instruction).toContain(
          'For hypotheses, propose merges ONLY for equivalent future states belonging to the same driver'
        );
        return response({
          groups: suggested
            ? [
                {
                  entityIds: ['chocolate-0', 'chocolate-1'],
                  title: 'Chocolate prices',
                  reason:
                    'The narrower price driver is covered by the broader driver in this exercise.'
                }
              ]
            : []
        });
      });
      vi.stubGlobal('fetch', fetcher);
      const h = harness(p);
      await launch(h.get, h.change, 'test-key', models, 'consolidate', [models[0].id]).done;
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(h.get().runs.at(-1)?.status).toBe('succeeded');
      const results = mergeResults(h.get(), 'driver');
      expect(results.state).toBe('complete');
      expect(results.proposed).toBe(suggested ? 1 : 0);
      expect(results.pending).toHaveLength(suggested ? 1 : 0);
      if (suggested)
        expect(results.pending[0]).toMatchObject({
          kind: 'driver',
          title: 'Chocolate prices',
          entityIds: ['chocolate-0', 'chocolate-1']
        });
      expect(JSON.stringify(h.get().drivers)).toBe(before);
    }
  );
  it('persists generated merge suggestions through the launch flow', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const p = exampleProject();
    p.stage = 4;
    const before = JSON.stringify(p.hypotheses);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          groups: [
            {
              entityIds: p.hypotheses.slice(0, 2).map((h) => h.id),
              title: 'Combined future',
              reason: 'Equivalent states'
            }
          ]
        })
      )
    );
    const h = harness(p);
    await launch(h.get, h.change, 'test-key', models, 'consolidate', [models[0].id]).done;
    expect(h.get().runs.at(-1)?.status).toBe('succeeded');
    expect(h.get().mergeSuggestions).toHaveLength(1);
    expect(h.get().mergeSuggestions[0].title).toBe('Combined future');
    expect(h.get().mergeSuggestions[0].runId).toBe(h.get().runs.at(-1)?.id);
    expect(JSON.stringify(h.get().hypotheses)).toBe(before);
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

describe('optional narrative assistance', () => {
  function writingProject() {
    const p = exampleProject();
    p.stage = 6;
    p.chains = p.chains.slice(0, 1);
    p.chains[0].approvedRevision = p.chains[0].revision;
    p.narratives = [
      {
        ...p.narratives[0],
        working: '**My own scenario.**',
        chosenId: null,
        original: undefined,
        drafts: [],
        final: null
      }
    ];
    return p;
  }
  it('includes the editing request in the allowance both as context and as an instruction', () => {
    const p = writingProject();
    const scope = [p.chains[0].id];
    const base = contextFor(p, 'narrative_edit', scope);
    const verbose = contextFor(p, 'narrative_edit', scope, undefined, {
      instructions: 'x'.repeat(4000)
    });
    expect(
      estimate(models[0], verbose, 'narrative_edit')! - estimate(models[0], base, 'narrative_edit')!
    ).toBeCloseTo(0.004);
  });
  it('estimates and sends the human text, chain and editing request without applying the response', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const p = writingProject();
    const c = p.chains[0];
    const options = { instructions: 'Make the pathway clearer.' };
    const h = harness(p);
    const plan = planRequests(
      p,
      models,
      'narrative_edit',
      [models[0].id],
      [c.id],
      undefined,
      options
    );
    expect(plan.requests[0].context.narrative).toEqual({
      text: '**My own scenario.**',
      instructions: options.instructions
    });
    expect(plan.estimatedTotal).toBeGreaterThan(0);
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ chainId: c.id, text: '**A clearer scenario.**' }));
    vi.stubGlobal('fetch', fetcher);
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'narrative_edit',
      [models[0].id],
      [c.id],
      undefined,
      options
    ).done;
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.messages[1].content).toContain('EDITING REQUEST:\nMake the pathway clearer.');
    expect(body.messages[1].content).toContain('**My own scenario.**');
    const n = h.get().narratives[0];
    expect(n.working).toBe('**My own scenario.**');
    expect(n.original?.text).toBe(n.working);
    expect(n.drafts[0]).toMatchObject({
      kind: 'edit',
      status: 'pending',
      baseText: n.working,
      instructions: options.instructions,
      chainRevision: c.revision,
      runId: h.get().runs[0].id
    });
    expect(h.get().runs[0].estimated).toBe(plan.estimatedTotal);
  });
  it('uses a clear default editing request and retains proposals when the analyst types or changes the chain', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const p = writingProject();
    const c = p.chains[0];
    const h = harness(p);
    let finish!: (r: Response) => void;
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    vi.stubGlobal('fetch', fetcher);
    const operation = launch(
      h.get,
      h.change,
      'test-key',
      models,
      'narrative_edit',
      [models[0].id],
      [c.id]
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body).messages[1].content).toContain(
      'Improve clarity and flow while preserving my voice and meaning.'
    );
    h.change((p) => {
      p.narratives[0].working = 'Newer writing';
      p.chains[0].revision++;
    });
    finish(response({ chainId: c.id, text: 'An edit of the older writing.' }));
    await operation.done;
    expect(h.get().runs[0].status).toBe('succeeded');
    expect(h.get().narratives[0].working).toBe('Newer writing');
    expect(h.get().narratives[0].drafts[0]).toMatchObject({
      text: 'An edit of the older writing.',
      baseText: '**My own scenario.**',
      chainRevision: 1
    });
  });
  it.each(['empty', 'unapproved', 'missing', 'multiple'] as const)(
    'blocks %s narrative edit requests before spending',
    (state) => {
      vi.stubGlobal('navigator', { onLine: true });
      const p = writingProject();
      const c = p.chains[0];
      if (state === 'empty') p.narratives[0].working = '  ';
      if (state === 'unapproved') c.approvedRevision = null;
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      const h = harness(p);
      expect(() =>
        launch(
          h.get,
          h.change,
          'test-key',
          models,
          'narrative_edit',
          [models[0].id],
          state === 'missing' ? ['missing'] : state === 'multiple' ? [c.id, c.id] : [c.id]
        )
      ).toThrow();
      expect(fetcher).not.toHaveBeenCalled();
      expect(h.get().runs).toHaveLength(0);
    }
  );
  it('retains failed edit instructions and retries explicitly using current text', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const p = writingProject();
    const c = p.chains[0];
    const h = harness(p);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(rawResponse('malformed'))
      .mockResolvedValueOnce(response({ chainId: c.id, text: 'A fresh edit.' }));
    vi.stubGlobal('fetch', fetcher);
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'narrative_edit',
      [models[0].id],
      [c.id],
      undefined,
      { instructions: 'Keep my tone.' }
    ).done;
    expect(h.get().runs[0].status).toBe('failed');
    expect(h.get().narratives[0].working).toBe('**My own scenario.**');
    expect(h.get().narratives[0].drafts).toEqual([]);
    h.change((p) => {
      p.narratives[0].working = 'Updated scenario';
    });
    const retry = h.get().runs[0];
    await launch(
      h.get,
      h.change,
      'test-key',
      models,
      'narrative_edit',
      [models[0].id],
      [c.id],
      retry.id
    ).done;
    const context = h.get().runs[1].context as {
      narrative: { text: string; instructions: string };
    };
    expect(context.narrative).toEqual({ text: 'Updated scenario', instructions: 'Keep my tone.' });
    expect(h.get().narratives[0].original?.text).toBe('**My own scenario.**');
    expect(h.get().narratives[0].working).toBe('Updated scenario');
    expect(h.get().runs[1].status).toBe('succeeded');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('generates an optional initial proposal without replacing human text', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const p = writingProject();
    const c = p.chains[0];
    const h = harness(p);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ chainId: c.id, text: 'A generated starting draft.' }))
    );
    await launch(h.get, h.change, 'test-key', models, 'narrative', [models[0].id], [c.id]).done;
    expect(h.get().narratives[0].working).toBe('**My own scenario.**');
    expect(h.get().narratives[0].drafts[0]).toMatchObject({
      kind: 'initial',
      baseText: '**My own scenario.**',
      status: 'pending'
    });
  });
});
