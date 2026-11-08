import { z } from 'zod';
import { FUSION_MODEL, effortSchema, type ReasoningEffort } from '$lib/domain/model-settings';

const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  context_length: z.number().nullable().optional(),
  pricing: z.object({ prompt: z.string(), completion: z.string(), request: z.string().optional() }),
  supported_parameters: z.array(z.string()).nullable().optional(),
  architecture: z
    .object({ output_modalities: z.array(z.string()) })
    .nullable()
    .optional(),
  endpoints: z.array(z.string()).nullable().optional(),
  top_provider: z
    .object({ max_completion_tokens: z.number().int().positive().nullable().optional() })
    .nullable()
    .optional(),
  reasoning: z
    .object({
      supported_efforts: z.array(effortSchema).nullable().optional(),
      default_effort: effortSchema.optional(),
      mandatory: z.boolean().optional(),
      default_enabled: z.boolean().optional(),
      supports_max_tokens: z.boolean().optional()
    })
    .nullable()
    .optional()
});
export type Model = z.infer<typeof modelSchema>;
export const isTextModel = (m: Model) =>
  !!m.architecture?.output_modalities.length &&
  m.architecture.output_modalities.every((v) => v === 'text') &&
  !m.id.endsWith(':batch') &&
  (!m.endpoints ||
    m.endpoints.includes(m.id === FUSION_MODEL ? '/api/v1/responses' : '/api/v1/chat/completions'));
export const isFreeModel = (m: Model) =>
  !!m.pricing.prompt.trim() &&
  !!m.pricing.completion.trim() &&
  Number(m.pricing.prompt) === 0 &&
  Number(m.pricing.completion) === 0 &&
  Number(m.pricing.request ?? '0') === 0;
export function supportedEfforts(m?: Model): ReasoningEffort[] {
  if (!m?.reasoning || m.reasoning.supported_efforts === undefined) return [];
  const values = m.reasoning.supported_efforts ?? effortSchema.options;
  return effortSchema.options.filter(
    (v) => values.includes(v) && !(v === 'none' && m.reasoning?.mandatory)
  );
}
export function effectiveEffort(
  m?: Model,
  preferred?: ReasoningEffort
): ReasoningEffort | undefined {
  const efforts = supportedEfforts(m);
  if (preferred && efforts.includes(preferred)) return preferred;
  if (efforts.includes('high')) return 'high';
  const value = m?.reasoning?.default_effort;
  return value && value !== 'none' && efforts.includes(value)
    ? value
    : efforts.find((v) => v !== 'none');
}
export function outputAllowance(base: number, m?: Model, effort?: ReasoningEffort) {
  const shares: Record<ReasoningEffort, number> = {
    max: 95,
    xhigh: 95,
    high: 80,
    medium: 50,
    low: 20,
    minimal: 10,
    none: 0
  };
  return Math.min(
    Math.ceil((base * 100) / (100 - (effort ? shares[effort] : 0))),
    m?.top_provider?.max_completion_tokens ?? 64000,
    64000
  );
}
export async function getModels(key = ''): Promise<Model[]> {
  const collected = new Map<string, Model>();
  const headers: HeadersInit = key.trim() ? { Authorization: `Bearer ${key.trim()}` } : {};
  for (let offset = 0; ; offset += 100) {
    const url = new URL(`https://openrouter.ai/api/v1/models${key.trim() ? '/user' : ''}`);
    url.search = new URLSearchParams({
      limit: '100',
      offset: String(offset),
      output_modalities: 'text',
      sort: 'intelligence-high-to-low'
    }).toString();
    const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok)
      throw new Error(
        'Could not load available models. Check your connection and key, then try again.'
      );
    const data = await response.json();
    if (!Array.isArray(data.data))
      throw new Error('The model list could not be read. Refresh to try again.');
    for (const entry of data.data) {
      const parsed = modelSchema.safeParse(entry);
      if (parsed.success && isTextModel(parsed.data)) collected.set(parsed.data.id, parsed.data);
    }
    if (
      data.links?.next === null ||
      data.data.length < 100 ||
      (typeof data.total_count === 'number' && offset + data.data.length >= data.total_count)
    )
      break;
  }
  return [...collected.values()];
}
