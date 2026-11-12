function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// Only retain the human-readable message, never raw provider metadata or credentials.
function safeMessage(value: unknown, key: string): string {
  if (typeof value !== 'string') return '';
  let message = value;
  for (const secret of [key, key.trim(), encodeURIComponent(key.trim())]) {
    if (secret) message = message.split(secret).join('[redacted]');
  }
  return message
    .replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[a-zA-Z0-9_-]+/g, '[redacted]')
    .replace(/[\s\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, 1000);
}

function retryWait(retryAfter: string | null): string {
  if (retryAfter?.trim()) {
    const value = retryAfter.trim();
    const seconds = /^\d+(?:\.\d+)?$/.test(value)
      ? Number(value)
      : (Date.parse(value) - Date.now()) / 1000;
    if (Number.isFinite(seconds) && seconds > 0)
      return `Wait at least ${Math.ceil(seconds)} seconds, then explicitly retry this model.`;
  }
  return 'Wait for those requests to settle, then explicitly retry this model.';
}

export function requestError(
  status: number,
  payload: unknown,
  key: string,
  retryAfter: string | null
): string {
  const error = record(record(payload).error);
  const metadata = record(error.metadata);
  let guidance: string;
  if ((status === 402 || status === 403) && metadata.limit_source === 'openrouter_key_limit') {
    guidance =
      'This request exceeds the OpenRouter API key’s spending allowance. Review this key’s limit or wait for its limit to reset. Adding account credits does not raise the key’s limit.';
  } else if (status === 402 && metadata.limit_source === 'openrouter_in_flight_budget') {
    guidance =
      'OpenRouter’s temporary spending allowance is occupied by running or recently completed requests. ' +
      retryWait(retryAfter);
  } else if (
    status === 402 &&
    metadata.limit_source === 'openrouter_credits' &&
    metadata.reason === 'weight_exceeds_budget'
  ) {
    guidance =
      'This request’s maximum token cost exceeds OpenRouter’s per-request spending allowance. Reduce thinking effort or choose a less expensive model before retrying.';
  } else if (status === 402 && metadata.limit_source === 'openrouter_credits') {
    guidance =
      'OpenRouter could not cover this request’s maximum token cost. Check your account balance, reduce thinking effort or choose a less expensive model.';
  } else if (
    status === 403 &&
    ['openrouter_workspace_budget', 'openrouter_guardrail_budget'].includes(
      String(metadata.limit_source)
    )
  ) {
    guidance =
      'An OpenRouter workspace or organisation spending limit blocked this request. Ask your administrator to review the limit or wait for it to reset.';
  } else {
    guidance =
      (
        {
          401: 'Key not accepted. Replace it in Model settings.',
          402: 'OpenRouter rejected this request’s credit allowance. Check the API key’s spending limit as well as your account balance. Large output allowances or other running requests can also cause this.',
          429: 'Rate limited. Wait, then explicitly retry this model.',
          404: 'Model unavailable. Choose a replacement in Model settings.'
        } as Record<number, string>
      )[status] ?? `OpenRouter request failed (${status}). Retry or choose another model.`;
  }
  const detail = safeMessage(error.message, key);
  return `${guidance}${detail ? ` OpenRouter (${status}): ${detail}` : ''}`;
}
