import { z } from 'zod';

export const FUSION_MODEL = 'openrouter/fusion';
export const defaultModels = ['~anthropic/claude-sonnet-latest'];
export const suggestedModels = [
  ...defaultModels,
  'mistralai/mistral-large-4-0',
  '~anthropic/claude-opus-latest',
  '~openai/gpt-sol-latest',
  '~google/gemini-pro-latest',
  '~moonshotai/kimi-latest',
  'meta/muse-wonder'
];
export const modelModeSchema = z.enum(['individual', 'fusion']);
export type ModelMode = z.infer<typeof modelModeSchema>;
export const effortSchema = z.enum(['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none']);
export type ReasoningEffort = z.infer<typeof effortSchema>;
export const effortLabels: Record<ReasoningEffort, string> = {
  max: 'Maximum',
  xhigh: 'Very high',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  minimal: 'Minimal',
  none: 'Off'
};
const names: Record<string, string> = {
  '~anthropic/claude-sonnet-latest': 'Claude Sonnet Latest',
  'mistralai/mistral-large-4-0': 'Mistral Large 4',
  '~moonshotai/kimi-latest': 'MoonshotAI: Kimi Latest',
  '~anthropic/claude-opus-latest': 'Claude Opus Latest',
  '~openai/gpt-sol-latest': 'GPT Sol Latest',
  '~google/gemini-pro-latest': 'Gemini Pro Latest',
  'meta/muse-wonder': 'Muse Wonder',
  [FUSION_MODEL]: 'OpenRouter Fusion',
  'openrouter/free': 'Free Models Router'
};
export const displayModelName = (id: string, catalogueName?: string) =>
  names[id] ?? catalogueName ?? id.split('/').slice(1).join('/').replace(/-/g, ' ');
export const modelName = (id: string) => displayModelName(id);
export function selectionMode(
  p: { modelMode?: ModelMode; modelModeOverrides?: Record<string, ModelMode> },
  scope = 'default'
): ModelMode {
  return (
    (scope === 'default' ? undefined : p.modelModeOverrides?.[scope]) ?? p.modelMode ?? 'individual'
  );
}

export interface ModelPreferences {
  models: string[];
  overrides: Record<string, string[]>;
  writer: string;
  modelMode: ModelMode;
  modelModeOverrides: Record<string, ModelMode>;
}
export const aiModelStages = [1, 2, 4, 5, 6];
export const hasStageModels = (p: ModelPreferences, scope: string) =>
  Object.hasOwn(p.overrides, scope) || Object.hasOwn(p.modelModeOverrides, scope);

// Writing produces one proposal at a time; old multi-model overrides retain their first writer.
export function stageModels(p: ModelPreferences, scope: string): string[] {
  if (scope === '6' || scope === '7')
    return [(p.overrides[scope] ?? p.overrides['6'])?.[0] ?? p.writer];
  return [...(p.overrides[scope] ?? p.models)];
}
export function customizeStageModels(p: ModelPreferences, scope: string) {
  if (!Object.hasOwn(p.overrides, scope)) p.overrides[scope] = stageModels(p, scope);
  if (!Object.hasOwn(p.modelModeOverrides, scope))
    p.modelModeOverrides[scope] = selectionMode(p, scope);
}
export function resetStageModels(p: ModelPreferences, scope: string) {
  delete p.overrides[scope];
  delete p.modelModeOverrides[scope];
}
export function requestModels(p: ModelPreferences, stage: number, single = false): string[] {
  const scope = String(stage === 7 ? 6 : stage);
  if (selectionMode(p, scope) === 'fusion') return [FUSION_MODEL];
  if (single) return [p.overrides[scope]?.[0] ?? p.writer];
  return stageModels(p, scope);
}
