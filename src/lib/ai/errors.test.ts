import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestError } from './errors';

afterEach(() => vi.useRealTimers());

describe('OpenRouter credit errors', () => {
  it.each([402, 403])('distinguishes a key spending cap from account credits (%i)', (status) => {
    const message = requestError(
      status,
      {
        error: {
          message: 'Key limit exceeded',
          metadata: { limit_source: 'openrouter_key_limit' }
        }
      },
      'session-key',
      null
    );
    expect(message).toContain('Adding account credits does not raise the key’s limit');
    expect(message).toContain(`OpenRouter (${status}): Key limit exceeded`);
  });

  it.each(['openrouter_workspace_budget', 'openrouter_guardrail_budget'])(
    'explains administrator-controlled spending limits (%s)',
    (limit_source) => {
      const message = requestError(
        403,
        { error: { metadata: { limit_source } } },
        'session-key',
        null
      );
      expect(message).toContain('Ask your administrator to review the limit');
    }
  );

  it('explains a temporary hold and honours Retry-After without advising a top-up', () => {
    const message = requestError(
      402,
      { error: { metadata: { limit_source: 'openrouter_in_flight_budget' } } },
      'session-key',
      '12.5'
    );
    expect(message).toContain('running or recently completed requests');
    expect(message).toContain('Wait at least 13 seconds');
    expect(message).not.toMatch(/add credits|account balance|key’s limit/i);
  });

  it.each(['Thu, 12 Nov 2026 12:00:30 GMT', '30'])(
    'accepts standard Retry-After values (%s)',
    (retryAfter) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
      expect(
        requestError(
          402,
          { error: { metadata: { limit_source: 'openrouter_in_flight_budget' } } },
          'session-key',
          retryAfter
        )
      ).toContain('Wait at least 30 seconds');
    }
  );

  it.each([null, 'invalid', '-1', '0'])('handles missing or unusable retry hints (%s)', (hint) => {
    expect(
      requestError(
        402,
        { error: { metadata: { limit_source: 'openrouter_in_flight_budget' } } },
        'session-key',
        hint
      )
    ).toContain('Wait for those requests to settle');
  });

  it('identifies a request too large to retry unchanged, even with a positive balance', () => {
    const message = requestError(
      402,
      {
        error: {
          metadata: { limit_source: 'openrouter_credits', reason: 'weight_exceeds_budget' }
        }
      },
      'session-key',
      null
    );
    expect(message).toContain('maximum token cost');
    expect(message).toContain('Reduce thinking effort or choose a less expensive model');
    expect(message).not.toContain('Wait');
  });

  it('retains the actual token affordability message when metadata is absent', () => {
    const detail = 'You requested up to 30000 tokens, but can only afford 20000.';
    const message = requestError(402, { error: { message: detail } }, 'session-key', null);
    expect(message).toContain(detail);
    expect(message).toContain('API key’s spending limit as well as your account balance');
  });

  it.each([null, [], { error: null }, { error: { message: {}, metadata: [] } }])(
    'falls back safely for unrecognised error bodies (%j)',
    (body) => {
      expect(requestError(402, body, 'session-key', null)).toContain('credit allowance');
      expect(requestError(503, body, 'session-key', null)).toContain('failed (503)');
    }
  );

  it('redacts credentials before limiting message length and omits raw metadata', () => {
    const message = requestError(
      402,
      {
        error: {
          message:
            'Rejected session-key; sk-or-v1-another-secret; Bearer other-credential. ' +
            'x'.repeat(2000),
          metadata: { raw: 'private provider payload', remedy_hint: 'untrusted instructions' }
        }
      },
      'session-key',
      null
    );
    expect(message).toContain('[redacted]');
    expect(message).not.toMatch(/session-key|sk-or-v1|other-credential|private provider|untrusted/);
    expect(message.length).toBeLessThan(1400);
  });
});
