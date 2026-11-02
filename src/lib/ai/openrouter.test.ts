import { describe, it, expect, vi, afterEach } from 'vitest';
import { exampleProject } from '$lib/domain/example';
import { newProject, reserved, type Project, type Run } from '$lib/domain/project';
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
  'narrative'
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
      narrative: { chainId: chain.id, text: 'A possible future.' }
    };
    const output = outputs[task];
    const fetcher = vi.fn().mockResolvedValue(response(output));
    vi.stubGlobal('fetch', fetcher);
    const h = harness(p);
    const targets = task === 'coherence' || task === 'narrative' ? [chain.id] : undefined;
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
      if (task !== 'narrative') {
        const list = schema.properties[Object.keys(output)[0]];
        expect(list.type).toBe('array');
        expect(list.items.additionalProperties).toBe(false);
      }
    } else expect(body.provider).toBeUndefined();
    expect(h.get().runs[0].status).toBe('succeeded');
    expect(fetcher).toHaveBeenCalledTimes(1);
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
