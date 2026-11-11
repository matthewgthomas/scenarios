import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getModels,
  isFreeModel,
  effectiveEffort,
  outputAllowance,
  supportedEfforts,
  type Model
} from './models';
import { newProject, parseProject, canSpend, defaultModels } from '$lib/domain/project';
import { selectionMode, FUSION_MODEL } from '$lib/domain/model-settings';
import { testKey } from './openrouter';

const model = (id = 'example/text', extra: Partial<Model> = {}): Model => ({
  id,
  name: id,
  context_length: 128000,
  pricing: { prompt: '0', completion: '0' },
  architecture: { output_modalities: ['text'] },
  endpoints: ['/api/v1/chat/completions'],
  ...extra
});
afterEach(() => vi.unstubAllGlobals());

describe('model discovery', () => {
  it('fetches every account page in intelligence order without exposing credentials in the URL', async () => {
    const first = Array.from({ length: 100 }, (_, i) => model(`example/${i}`));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: first, total_count: 101, links: { next: '/unused' } }))
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [model('example/last')], total_count: 101, links: { next: null } })
        )
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await getModels('session-key')).toHaveLength(101);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, options] = fetcher.mock.calls[1];
    expect(url).toContain('/models/user?');
    expect(new URL(url).searchParams.get('offset')).toBe('100');
    expect(new URL(url).searchParams.get('output_modalities')).toBe('text');
    expect(new URL(url).searchParams.get('sort')).toBe('intelligence-high-to-low');
    expect(url).not.toContain('session-key');
    expect(options.headers.Authorization).toBe('Bearer session-key');
  });
  it('only offers text output and compatible transports, handles nulls and deduplicates IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              model(),
              model(),
              model('example/media', { architecture: { output_modalities: ['text', 'audio'] } }),
              model('example/image', { architecture: { output_modalities: ['image'] } }),
              model('example/unknown', { architecture: null }),
              model('example/batch:batch'),
              model('example/embedding', { endpoints: ['/api/v1/embeddings'] }),
              model(FUSION_MODEL, {
                context_length: null,
                endpoints: ['/api/v1/responses'],
                top_provider: null,
                reasoning: null
              }),
              { id: 'invalid' }
            ]
          })
        )
      )
    );
    expect((await getModels()).map((m) => m.id)).toEqual(['example/text', FUSION_MODEL]);
    const fetcher = vi.mocked(fetch);
    expect(fetcher.mock.calls[0][0]).not.toContain('/user');
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({});
  });
  it('fails account discovery explicitly instead of falling back to public availability', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(getModels('restricted-key')).rejects.toThrow('Could not load');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not classify unknown or per-request pricing as free', () => {
    expect(isFreeModel(model())).toBe(true);
    expect(isFreeModel(model('example/empty', { pricing: { prompt: '', completion: '' } }))).toBe(
      false
    );
    expect(
      isFreeModel(model('example/free:free', { pricing: { prompt: '-1', completion: '-1' } }))
    ).toBe(false);
    expect(
      isFreeModel(
        model('example/request', { pricing: { prompt: '0', completion: '0', request: '.01' } })
      )
    ).toBe(false);
    expect(
      isFreeModel(model('example/invalid', { pricing: { prompt: 'NaN', completion: '0' } }))
    ).toBe(false);
  });
  it('accepts an authenticated key with no paid allowance for free model use', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { limit_remaining: 0 } })))
    );
    expect(await testKey('test-key')).toEqual({ paidAllowanceAvailable: false });
  });
});

describe('thinking effort', () => {
  it('prefers High over provider defaults, respects choices and mandatory reasoning', () => {
    const m = model('example/thinking', {
      reasoning: {
        supported_efforts: ['max', 'high', 'low', 'none'],
        default_effort: 'max',
        mandatory: true
      }
    });
    expect(effectiveEffort(m)).toBe('high');
    expect(effectiveEffort(m, 'low')).toBe('low');
    expect(effectiveEffort(m, 'medium')).toBe('high');
    expect(supportedEfforts(m)).not.toContain('none');
    expect(effectiveEffort(model())).toBeUndefined();
    expect(
      supportedEfforts(model('example/automatic', { reasoning: { mandatory: true } }))
    ).toEqual([]);
  });
  it('uses only advertised efforts, including null meaning all gateway values', () => {
    expect(
      effectiveEffort(
        model('x/y', { reasoning: { supported_efforts: ['medium', 'low'], default_effort: 'low' } })
      )
    ).toBe('low');
    expect(
      effectiveEffort(
        model('x/y', {
          reasoning: { supported_efforts: ['medium', 'low'], default_effort: 'none' }
        })
      )
    ).toBe('medium');
    expect(effectiveEffort(model('x/y', { reasoning: { supported_efforts: null } }))).toBe('high');
    expect(
      effectiveEffort(model('x/y', { reasoning: { supported_efforts: ['none'] } }))
    ).toBeUndefined();
  });
  it('preserves room for final output, counts reasoning and enforces provider limits', () => {
    expect(outputAllowance(6000, model(), 'high')).toBe(30000);
    expect(outputAllowance(6000, model(), 'medium')).toBe(12000);
    expect(outputAllowance(6000, model(), 'max')).toBe(64000);
    expect(
      outputAllowance(6000, model('x/y', { top_provider: { max_completion_tokens: 8000 } }), 'high')
    ).toBe(8000);
    expect(outputAllowance(6000, model())).toBe(6000);
  });
});

describe('compatible exercise preferences', () => {
  it('starts new scenarios with one recommended model and leaves old selections intact', () => {
    expect(newProject().models).toEqual(['~anthropic/claude-sonnet-latest']);
    const old = JSON.parse(JSON.stringify(newProject()));
    old.models = ['anthropic/claude-sonnet-4.5', 'openai/gpt-5-mini', 'google/gemini-2.5-flash'];
    delete old.modelMode;
    delete old.modelModeOverrides;
    delete old.reasoningEfforts;
    const restored = parseProject(old);
    expect(restored.models).toEqual(old.models);
    expect(restored.modelMode).toBe('individual');
    expect(restored.reasoningEfforts).toEqual({});
    expect(defaultModels).not.toEqual(old.models);
  });
  it('round-trips mode, stage inheritance and efforts without changing individual models or writer', () => {
    const p = newProject();
    const writer = p.writer;
    p.modelMode = 'fusion';
    p.modelModeOverrides['5'] = 'individual';
    p.reasoningEfforts[p.models[0]] = 'low';
    const restored = parseProject(JSON.parse(JSON.stringify(p)));
    expect(selectionMode(restored, '1')).toBe('fusion');
    expect(selectionMode(restored, '5')).toBe('individual');
    expect(restored.models).toEqual(defaultModels);
    expect(restored.writer).toBe(writer);
    expect(restored.reasoningEfforts[p.models[0]]).toBe('low');
    delete restored.modelModeOverrides['5'];
    expect(selectionMode(restored, '5')).toBe('fusion');
  });
  it('permits verified zero-cost work even after the local budget has been exceeded', () => {
    const p = newProject();
    p.budget = 0.01;
    p.runs = [{ id: 'paid', confirmed: 1 } as (typeof p.runs)[number]];
    expect(canSpend(p, 0)).toBe(true);
    expect(canSpend(p, 0.01)).toBe(false);
  });
});
