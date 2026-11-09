import { z } from 'zod';
import { defaultModels, modelModeSchema, effortSchema } from './model-settings';
export { defaultModels, modelName } from './model-settings';

export const stages = [
  'Define analysis',
  'Explore drivers',
  'Assess drivers',
  'Select uncertainties',
  'Develop hypotheses',
  'Construct chains',
  'Write & review scenarios',
  'Write & review scenarios',
  'Export',
  'Models and budget'
] as const;
export const MODEL_SETUP_STAGE = 9;
export const modelSetupSteps = ['connection', 'models', 'budget'] as const;
// Keep persisted stage IDs and historical run records compatible with version 1.0.
// Stage 7 is the former review stage; it now opens the unified writing workspace.
export const canonicalStage = (stage: number) => (stage === 7 ? 6 : stage);
// The new setup stage follows Define analysis without renumbering saved analytical stages or runs.
export const workflowStages = [0, MODEL_SETUP_STAGE, 1, 2, 3, 4, 5, 6, 8].map((id) => ({
  id,
  title: stages[id]
}));
export const coreStageCount = workflowStages.length - 1;
export const stageIsComplete = (p: Project, stage: number) =>
  p.completed.includes(canonicalStage(stage) === 6 ? 7 : stage);
export const stageNeedsReview = (p: Project, stage: number) =>
  canonicalStage(stage) === 6
    ? p.stale.includes(6) || p.stale.includes(7)
    : p.stale.includes(stage);
export const completedStageCount = (p: Project) =>
  workflowStages.filter(({ id }) => id !== 8 && stageIsComplete(p, id) && !stageNeedsReview(p, id))
    .length;
const origin = z.object({ modelId: z.string(), text: z.string(), runId: z.string() });
const score = z.number().min(1).max(5);
const rating = z.object({
  modelId: z.string(),
  runId: z.string(),
  impact: score.int(),
  uncertainty: score.int(),
  rationale: z.string(),
  driverRevision: z.number()
});
const decision = z.object({
  impact: score,
  uncertainty: score,
  type: z.enum(['explicitly_edited', 'bulk_accepted_median']),
  at: z.string(),
  revision: z.number()
});
const driver = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string(),
  tags: z.array(z.string()),
  origin: z.enum(['user', 'ai', 'example', 'wildcard']),
  origins: z.array(origin),
  revision: z.number(),
  approved: z.boolean(),
  selected: z.boolean(),
  ratings: z.array(rating),
  decision: decision.optional(),
  archived: z.boolean().default(false),
  assessment: z.string().optional(),
  history: z
    .array(z.object({ title: z.string(), summary: z.string(), revision: z.number() }))
    .default([])
});
const hypothesis = z.object({
  id: z.string(),
  driverId: z.string(),
  title: z.string().min(1),
  description: z.string(),
  origins: z.array(origin),
  revision: z.number(),
  approved: z.boolean(),
  archived: z.boolean().default(false),
  history: z
    .array(z.object({ title: z.string(), description: z.string(), revision: z.number() }))
    .default([])
});
const note = z.object({
  modelId: z.string(),
  runId: z.string(),
  revision: z.number(),
  at: z.string(),
  reasoning: z.string(),
  tensions: z.array(z.string()),
  assumptions: z.array(z.string())
});
const chain = z.object({
  id: z.string(),
  title: z.string().min(1),
  kind: z.enum(['main', 'wildcard']),
  colour: z.number().int().min(1).max(6),
  items: z.record(z.string(), z.string().nullable()),
  revision: z.number(),
  selected: z.boolean(),
  archived: z.boolean().default(false),
  explanation: z.string().nullable().default(null),
  approvedRevision: z.number().nullable(),
  review: z.boolean(),
  notes: z.array(note),
  origins: z.array(origin),
  wildcardDriverIds: z.array(z.string()),
  distinctiveness: z.string(),
  snapshots: z
    .array(
      z.object({
        revision: z.number(),
        at: z.string(),
        title: z.string(),
        explanation: z.string().nullable().default(null),
        items: z.record(z.string(), z.string().nullable()),
        states: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            revision: z.number()
          })
        )
      })
    )
    .default([])
});
const draft = z.object({
  id: z.string(),
  modelId: z.string(),
  runId: z.string(),
  text: z.string(),
  at: z.string(),
  chainRevision: z.number(),
  kind: z.enum(['initial', 'edit']).optional(),
  baseText: z.string().optional(),
  instructions: z.string().optional(),
  status: z.enum(['pending', 'accepted', 'dismissed']).optional()
});
const narrative = z.object({
  id: z.string(),
  chainId: z.string(),
  drafts: z.array(draft),
  chosenId: z.string().nullable(),
  working: z.string(),
  chainRevision: z.number().optional(),
  original: z
    .object({
      text: z.string(),
      at: z.string(),
      chainRevision: z.number(),
      source: z.enum(['user', 'ai', 'example']),
      modelId: z.string().optional(),
      runId: z.string().optional()
    })
    .optional(),
  final: z.string().nullable(),
  finalAt: z.string().nullable(),
  review: z.boolean(),
  history: z.array(z.string()),
  redo: z.array(z.string()),
  checklist: z.array(z.string()),
  annotationsDetached: z.boolean()
});
export const runSchema = z.object({
  id: z.string(),
  operationId: z.string(),
  exerciseId: z.string(),
  stage: z.number(),
  task: z.enum([
    'drivers',
    'ratings',
    'hypotheses',
    'chains',
    'coherence',
    'narrative',
    'narrative_edit',
    'consolidate'
  ]),
  modelId: z.string(),
  promptTemplateVersion: z.enum(['quick-1', 'quick-2', 'quick-3', 'quick-4']),
  reasoningEffort: effortSchema.optional(),
  resolvedModelId: z.string().optional(),
  fusionInvoked: z.boolean().optional(),
  costBasis: z.enum(['estimate', 'allowance']).optional(),
  inputRevision: z.number(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'skipped']),
  at: z.string(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
  retryOf: z.string().optional(),
  estimated: z.number().nonnegative(),
  confirmed: z.number().nonnegative().nullable(),
  unknownCharge: z.boolean(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  batchIndex: z.number().int().positive().optional(),
  batchCount: z.number().int().positive().optional(),
  rawOutput: z.string().optional(),
  finishReason: z.string().optional(),
  nativeFinishReason: z.string().optional(),
  output: z.unknown().optional(),
  context: z.unknown(),
  targetIds: z.array(z.string())
});
export const projectSchema = z.object({
  schemaVersion: z.literal('1.0'),
  id: z.string(),
  title: z.string().min(1),
  question: z.string(),
  horizon: z.string(),
  mode: z.literal('quick'),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number(),
  stage: z.number().int().min(0).max(MODEL_SETUP_STAGE),
  modelSetupStep: z.enum(modelSetupSteps).default('connection'),
  example: z.boolean(),
  budget: z.number().positive().nullable(),
  models: z.array(z.string()).min(1),
  overrides: z.record(z.string(), z.array(z.string()).min(1)),
  writer: z.string(),
  modelMode: modelModeSchema.default('individual'),
  modelModeOverrides: z.record(z.string(), modelModeSchema).default({}),
  reasoningEfforts: z.record(z.string(), effortSchema).default({}),
  // Legacy generation targets: retained for version 1.0 backup compatibility only.
  mainCount: z.number().int().min(1).max(12),
  wildcardCount: z.number().int().min(0).max(6),
  completed: z.array(z.number()),
  stale: z.array(z.number()),
  drivers: z.array(driver),
  hypotheses: z.array(hypothesis),
  chains: z.array(chain),
  narratives: z.array(narrative),
  runs: z.array(runSchema),
  mergeSuggestions: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(['driver', 'hypothesis']),
        entityIds: z.array(z.string()).min(2),
        title: z.string(),
        reason: z.string(),
        modelId: z.string(),
        runId: z.string(),
        status: z.enum(['pending', 'accepted', 'dismissed'])
      })
    )
    .default([]),
  events: z.array(z.object({ at: z.string(), revision: z.number(), message: z.string() }))
});
export type Project = Omit<z.infer<typeof projectSchema>, 'drivers' | 'hypotheses' | 'chains'> & {
  drivers: Driver[];
  hypotheses: Hypothesis[];
  chains: Chain[];
};
export type Driver = Omit<z.infer<typeof driver>, 'history'> & {
  history?: z.infer<typeof driver>['history'];
};
export type Hypothesis = Omit<z.infer<typeof hypothesis>, 'history'> & {
  history?: z.infer<typeof hypothesis>['history'];
};
export type Chain = Omit<z.infer<typeof chain>, 'snapshots' | 'archived' | 'explanation'> & {
  archived?: boolean;
  explanation?: string | null;
  snapshots?: z.infer<typeof chain>['snapshots'];
};
export type Narrative = z.infer<typeof narrative>;
export type Run = z.infer<typeof runSchema>;
export type Change = (fn: (project: Project) => void, message?: string) => void;
export const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export const now = () => new Date().toISOString();
export const activeDrivers = (p: Project) =>
  p.drivers.filter((d) => !d.archived && d.origin !== 'wildcard');
export const activeChains = (p: Project) => p.chains.filter((c) => !c.archived);
export const chainExplanation = (c: Chain) => c.explanation ?? c.notes[0]?.reasoning ?? '';
export function approvedChainSet(p: Project): boolean {
  const selected = activeChains(p).filter((c) => c.selected);
  return (
    p.completed.includes(5) &&
    !p.stale.includes(5) &&
    selected.length > 0 &&
    selected.every((c) => c.approvedRevision === c.revision && !c.review)
  );
}

/** Local set decisions never discard writing or initiate model work. */
export function invalidateChainSet(p: Project, affectedIds: string[] = []) {
  p.completed = p.completed.filter((s) => s !== 5);
  flagDownstream(
    p,
    5,
    'Scenario set changed. Review and approve your set before continuing.',
    affectedIds
  );
}
export function includeChain(p: Project, chainId: string, selected: boolean) {
  const c = activeChains(p).find((c) => c.id === chainId);
  if (!c || c.selected === selected) return;
  c.selected = selected;
  invalidateChainSet(p);
}
export function editChainExplanation(p: Project, chainId: string, explanation: string) {
  const c = activeChains(p).find((c) => c.id === chainId);
  if (!c) return;
  // Saving a blank manual explanation must opt out of future model starting text.
  if (explanation === chainExplanation(c) && (explanation !== '' || c.explanation === '')) return;
  snapshotChain(p, c);
  c.explanation = explanation;
  c.revision++;
  invalidateChainSet(p, [c.id]);
}
export function archiveChain(p: Project, chainId: string, archived = true) {
  const c = p.chains.find((c) => c.id === chainId);
  if (!c || !!c.archived === archived) return;
  snapshotChain(p, c);
  c.archived = archived;
  c.selected = false;
  c.revision++;
  invalidateChainSet(p, [c.id]);
}
export const uncertainties = (p: Project) => activeDrivers(p).filter((d) => d.selected);
export const statesFor = (p: Project, driverId: string) =>
  p.hypotheses.filter((h) => h.driverId === driverId && !h.archived);
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
export function coordinates(d: Driver) {
  const ratings = d.ratings.filter((r) => r.driverRevision === d.revision);
  return {
    impact:
      d.decision?.revision === d.revision
        ? d.decision.impact
        : median(ratings.map((r) => r.impact)),
    uncertainty:
      d.decision?.revision === d.revision
        ? d.decision.uncertainty
        : median(ratings.map((r) => r.uncertainty))
  };
}
export function disagreement(d: Driver) {
  const scores = d.ratings.filter((r) => r.driverRevision === d.revision);
  if (!scores.length) return 0;
  return (
    Math.max(...scores.map((s) => s.impact)) -
    Math.min(...scores.map((s) => s.impact)) +
    Math.max(...scores.map((s) => s.uncertainty)) -
    Math.min(...scores.map((s) => s.uncertainty))
  );
}
export function newProject(): Project {
  return {
    schemaVersion: '1.0',
    id: id('exercise'),
    title: 'Untitled exercise',
    question: '',
    horizon: '',
    mode: 'quick',
    createdAt: now(),
    updatedAt: now(),
    revision: 1,
    stage: 0,
    modelSetupStep: 'connection',
    example: false,
    budget: 5,
    models: [...defaultModels],
    overrides: {},
    writer: defaultModels[0],
    modelMode: 'individual',
    modelModeOverrides: {},
    reasoningEfforts: {},
    mainCount: 3,
    wildcardCount: 0,
    completed: [],
    stale: [],
    drivers: [],
    hypotheses: [],
    chains: [],
    narratives: [],
    runs: [],
    mergeSuggestions: [],
    events: []
  };
}
export function complete(p: Project, stage: number) {
  if (!p.completed.includes(stage)) p.completed.push(stage);
  p.stale = p.stale.filter((s) => s !== stage);
}
export function approveDriverScores(
  p: Project,
  driverId: string,
  impact: number,
  uncertainty: number
) {
  const d = p.drivers.find((d) => d.id === driverId)!;
  d.decision = {
    impact,
    uncertainty,
    type: 'explicitly_edited',
    at: now(),
    revision: d.revision
  };
  flagDownstream(
    p,
    2,
    `${d.title} assessment edited. Review selected uncertainties and saved work.`
  );
  if (activeDrivers(p).every((d) => d.decision?.revision === d.revision)) complete(p, 2);
}
export function flagDownstream(
  p: Project,
  from: number,
  message: string,
  affectedChainIds?: string[]
) {
  for (const stage of p.completed.filter((s) => s > from && s !== MODEL_SETUP_STAGE))
    if (!p.stale.includes(stage)) p.stale.push(stage);
  p.chains.forEach((c) => {
    if (!affectedChainIds || affectedChainIds.includes(c.id)) c.review = true;
  });
  p.narratives.forEach((n) => {
    if (!affectedChainIds || affectedChainIds.includes(n.chainId)) n.review = true;
  });
  p.events.push({ at: now(), revision: p.revision, message });
}
export function editHypothesis(
  p: Project,
  hypothesisId: string,
  title: string,
  description: string
) {
  const h = p.hypotheses.find((h) => h.id === hypothesisId)!;
  const affected = p.chains.filter((c) => Object.values(c.items).includes(h.id));
  affected.forEach((c) => snapshotChain(p, c));
  (h.history ??= []).push({ title: h.title, description: h.description, revision: h.revision });
  h.title = title.trim() || h.title;
  h.description = description;
  h.revision++;
  h.approved = false;
  affected.forEach((c) => c.revision++);
  flagDownstream(
    p,
    4,
    `${h.title} changed. ${affected.length} dependent chains and their narratives may need review.`,
    affected.map((c) => c.id)
  );
}
export function setChainItem(
  p: Project,
  chainId: string,
  driverId: string,
  hypothesisId: string | null
) {
  const c = activeChains(p).find((c) => c.id === chainId);
  if (!c || c.items[driverId] === hypothesisId) return;
  snapshotChain(p, c);
  c.items[driverId] = hypothesisId;
  c.revision++;
  c.review = true;
  p.completed = p.completed.filter((s) => s !== 5);
  flagDownstream(
    p,
    5,
    `${c.title} changed at revision ${c.revision}. Earlier coherence notes and narratives are preserved.`,
    [c.id]
  );
}
export function spent(p: Project) {
  return p.runs.reduce((s, r) => s + (r.confirmed ?? 0), 0);
}
export function reserved(p: Project) {
  return p.runs
    .filter((r) => ['queued', 'running'].includes(r.status))
    .reduce((s, r) => s + r.estimated, 0);
}
export function uncertainSpend(p: Project) {
  return p.runs
    .filter((r) => r.unknownCharge && !['queued', 'running'].includes(r.status))
    .reduce((s, r) => s + r.estimated, 0);
}
export function canSpend(p: Project, estimate: number) {
  if (estimate === 0) return true;
  return p.budget === null || spent(p) + reserved(p) + uncertainSpend(p) + estimate <= p.budget;
}
export function prerequisite(p: Project, stage: number): string | null {
  stage = canonicalStage(stage);
  if (stage === 0 || stage === 8) return null;
  // Reopening existing prose must remain possible after upstream decisions change.
  if (
    stage === 6 &&
    p.narratives.some(
      (n) =>
        activeChains(p).some((c) => c.selected && c.id === n.chainId) &&
        (n.chainRevision !== undefined || n.original || n.chosenId || n.working.trim())
    )
  )
    return null;
  if (!p.question.trim() || !p.horizon.trim())
    return 'Add an analytical question and time horizon in Define analysis.';
  if (stage === MODEL_SETUP_STAGE) return null;
  if (!p.completed.includes(MODEL_SETUP_STAGE))
    return 'Connect OpenRouter, choose your models and set a budget in Models and budget.';
  if (stage >= 2 && !activeDrivers(p).some((d) => d.approved))
    return 'Approve the driver list in Explore drivers.';
  if (stage >= 3 && !activeDrivers(p).every((d) => d.decision?.revision === d.revision))
    return 'Review and approve scores for every driver in Assess drivers.';
  if (stage >= 4 && (!p.completed.includes(3) || !uncertainties(p).length))
    return 'Select and approve your critical uncertainties.';
  if (stage >= 5 && !uncertainties(p).every((d) => statesFor(p, d.id).some((h) => h.approved)))
    return 'Approve at least one hypothesis for each uncertainty.';
  if (stage >= 6 && !approvedChainSet(p)) return 'Approve selected chains in Construct chains.';
  return null;
}
export function parseProject(value: unknown): Project {
  const p = projectSchema.parse(value);
  p.stage = canonicalStage(p.stage);
  // Existing exercises can continue where they left off, with their model choices intact.
  if (
    value &&
    typeof value === 'object' &&
    !Object.hasOwn(value, 'modelSetupStep') &&
    (p.completed.includes(0) || (p.stage > 0 && p.stage !== MODEL_SETUP_STAGE))
  ) {
    complete(p, MODEL_SETUP_STAGE);
    p.modelSetupStep = 'budget';
  }
  if (!p.overrides['6'] && p.overrides['7']) p.overrides['6'] = [...p.overrides['7']];
  if (
    new Set(p.drivers.map((d) => d.id)).size !== p.drivers.length ||
    new Set(p.hypotheses.map((h) => h.id)).size !== p.hypotheses.length ||
    new Set(p.chains.map((c) => c.id)).size !== p.chains.length
  )
    throw new Error('Duplicate analytical IDs. Import a valid project backup.');
  for (const h of p.hypotheses)
    if (!p.drivers.some((d) => d.id === h.driverId))
      throw new Error('A hypothesis refers to a missing driver.');
  for (const c of p.chains)
    for (const [driverId, hypothesisId] of Object.entries(c.items)) {
      if (
        !p.drivers.some((d) => d.id === driverId) ||
        (hypothesisId &&
          !p.hypotheses.some((h) => h.id === hypothesisId && h.driverId === driverId))
      )
        throw new Error('A chain has an invalid hypothesis reference.');
    }
  for (const n of p.narratives) {
    if (!p.chains.some((c) => c.id === n.chainId))
      throw new Error('A narrative refers to a missing chain.');
    const chosen = n.drafts.find((d) => d.id === n.chosenId);
    if (!n.original && chosen) {
      n.original = {
        text: chosen.text,
        at: chosen.at,
        chainRevision: chosen.chainRevision,
        source: chosen.modelId === 'authored/example' ? 'example' : 'ai',
        modelId: chosen.modelId,
        runId: chosen.runId
      };
    }
    n.chainRevision ??= n.original?.chainRevision;
  }
  return p;
}
export function narrativeFor(p: Project, chainId: string): Narrative {
  let n = p.narratives.find((n) => n.chainId === chainId);
  if (!n) {
    n = {
      id: id('narrative'),
      chainId,
      drafts: [],
      chosenId: null,
      working: '',
      final: null,
      finalAt: null,
      review: false,
      history: [],
      redo: [],
      checklist: [],
      annotationsDetached: false
    };
    p.narratives.push(n);
  }
  return n;
}
export function allNarrativesWritten(p: Project): boolean {
  const chains = activeChains(p).filter((c) => c.selected);
  return (
    chains.length > 0 &&
    chains.every((c) => p.narratives.some((n) => n.chainId === c.id && n.working.trim().length > 0))
  );
}
export function canWriteNarrative(p: Project, chainId: string): boolean {
  const chain = activeChains(p).find((c) => c.id === chainId);
  const n = p.narratives.find((n) => n.chainId === chainId);
  return (
    !!chain &&
    (chain.approvedRevision === chain.revision ||
      n?.chainRevision !== undefined ||
      !!n?.original ||
      !!n?.chosenId ||
      !!n?.working.trim())
  );
}
function narrativeChanged(p: Project, n: Narrative) {
  n.annotationsDetached = true;
  p.completed = p.completed.filter(
    (stage) => stage !== 7 && stage !== 8 && (stage !== 6 || allNarrativesWritten(p))
  );
}
export function editNarrative(p: Project, chainId: string, text: string) {
  if (!canWriteNarrative(p, chainId)) return;
  const n = narrativeFor(p, chainId);
  if (text === n.working) return;
  n.chainRevision ??= p.chains.find((c) => c.id === chainId)!.revision;
  n.history.push(n.working);
  if (n.history.length > 100) n.history.shift();
  n.redo = [];
  n.working = text;
  narrativeChanged(p, n);
}
export function undoNarrative(p: Project, chainId: string, redo = false) {
  const n = p.narratives.find((n) => n.chainId === chainId);
  if (!n) return;
  const source = redo ? n.redo : n.history;
  if (!source.length) return;
  (redo ? n.history : n.redo).push(n.working);
  n.working = source.pop()!;
  narrativeChanged(p, n);
}
export function snapshotNarrative(p: Project, chainId: string) {
  const n = p.narratives.find((n) => n.chainId === chainId);
  if (!n || n.original || !n.working.trim()) return;
  n.original = {
    text: n.working,
    at: now(),
    chainRevision: n.chainRevision ?? p.chains.find((c) => c.id === chainId)!.revision,
    source: 'user'
  };
}
export function prepareNarrativeReview(p: Project) {
  if (!allNarrativesWritten(p)) return;
  activeChains(p)
    .filter((c) => c.selected)
    .forEach((c) => snapshotNarrative(p, c.id));
  complete(p, 6);
}
export function proposalIsCurrent(p: Project, chainId: string, draftId: string): boolean {
  const n = p.narratives.find((n) => n.chainId === chainId);
  const d = n?.drafts.find((d) => d.id === draftId);
  const c = activeChains(p).find((c) => c.id === chainId);
  return (
    !!d &&
    !!c &&
    d.status !== 'dismissed' &&
    d.status !== 'accepted' &&
    d.chainRevision === c.revision &&
    c.approvedRevision === c.revision &&
    (d.baseText === undefined ? !n!.working.trim() : d.baseText === n!.working)
  );
}
export function applyNarrativeProposal(p: Project, chainId: string, draftId: string) {
  if (!proposalIsCurrent(p, chainId, draftId)) return;
  const n = narrativeFor(p, chainId);
  const d = n.drafts.find((d) => d.id === draftId)!;
  snapshotNarrative(p, chainId);
  if (!n.original) {
    n.original = {
      text: d.text,
      at: d.at,
      chainRevision: d.chainRevision,
      source: d.modelId === 'authored/example' ? 'example' : 'ai',
      modelId: d.modelId,
      runId: d.runId
    };
  }
  editNarrative(p, chainId, d.text);
  n.chainRevision = d.chainRevision;
  n.review = false;
  d.status = 'accepted';
  if (d.kind !== 'edit') n.chosenId = d.id;
}
export function snapshotChain(p: Project, c: Chain) {
  if ((c.snapshots ??= []).some((s) => s.revision === c.revision)) return;
  c.snapshots.push({
    revision: c.revision,
    at: now(),
    title: c.title,
    explanation: chainExplanation(c),
    items: { ...c.items },
    states: p.hypotheses
      .filter((h) => Object.values(c.items).includes(h.id))
      .map((h) => ({ id: h.id, title: h.title, description: h.description, revision: h.revision }))
  });
}
