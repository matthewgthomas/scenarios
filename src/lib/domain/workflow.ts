import {
  activeDrivers,
  activeChains,
  approvedChainSet,
  canonicalStage,
  MODEL_SETUP_STAGE,
  uncertainties,
  snapshotChain,
  complete,
  prerequisite,
  allNarrativesWritten,
  prepareNarrativeReview,
  now,
  type Project
} from './project';

/** Resolve optional AI setup while retaining model choices for any later AI requests. */
export function skipModelSetup(p: Project): boolean {
  if (prerequisite(p, MODEL_SETUP_STAGE)) return false;
  complete(p, MODEL_SETUP_STAGE);
  p.modelSetupStatus = 'skipped';
  p.stage = 1;
  return true;
}

export function chainReadiness(p: Project) {
  const selected = activeChains(p).filter((c) => c.selected);
  const candidateIssues = activeChains(p).flatMap((c) => [
    ...uncertainties(p)
      .filter((d) => !Object.hasOwn(c.items, d.id))
      .map((d) => ({
        chainId: c.id,
        driverId: d.id,
        message: `${c.title}: choose an outcome for ${d.title}, or deliberately leave it unresolved.`
      })),
    ...uncertainties(p)
      .filter(
        (d) =>
          c.items[d.id] &&
          !p.hypotheses.some(
            (h) => h.id === c.items[d.id] && h.driverId === d.id && h.approved && !h.archived
          )
      )
      .map((d) => ({
        chainId: c.id,
        driverId: d.id,
        message: `${c.title}: choose an approved hypothesis for ${d.title}, or mark it unresolved.`
      })),
    ...c.wildcardDriverIds
      .filter((id) => !p.drivers.find((d) => d.id === id)?.approved)
      .map((id) => ({
        chainId: c.id,
        driverId: undefined,
        message: `${c.title}: review the additional driver “${p.drivers.find((d) => d.id === id)?.title ?? id}”.`
      }))
  ]);
  const issues = candidateIssues.filter((issue) => selected.some((c) => c.id === issue.chainId));
  return {
    selected,
    issues,
    candidateIssues,
    canApprove: selected.length > 0 && !issues.length
  };
}

export function approveChainSet(p: Project): boolean {
  const readiness = chainReadiness(p);
  if (!readiness.canApprove) return false;
  readiness.selected.forEach((c) => {
    snapshotChain(p, c);
    c.approvedRevision = c.revision;
    c.review = false;
  });
  complete(p, 5);
  return true;
}

export function completeScenarioSet(p: Project): boolean {
  if (!allNarrativesWritten(p) || !approvedChainSet(p) || !chainReadiness(p).canApprove)
    return false;
  prepareNarrativeReview(p);
  activeChains(p)
    .filter((c) => c.selected)
    .forEach((c) => {
      const n = p.narratives.find((n) => n.chainId === c.id)!;
      n.final = n.working;
      n.finalAt = now();
      n.chainRevision = c.revision;
      n.review = false;
    });
  complete(p, 7);
  return true;
}

/** The first unmet dependency, so a blocked page can offer the actual route to repair. */
export function prerequisiteStage(p: Project, stage: number): number {
  stage = canonicalStage(stage);
  if (!p.question.trim() || !p.horizon.trim()) return 0;
  if (stage === MODEL_SETUP_STAGE) return 0;
  if (!p.completed.includes(MODEL_SETUP_STAGE)) return MODEL_SETUP_STAGE;
  if (!activeDrivers(p).some((d) => d.approved)) return 1;
  if (stage >= 3 && activeDrivers(p).some((d) => d.decision?.revision !== d.revision)) return 2;
  if (stage >= 4 && (!p.completed.includes(3) || !uncertainties(p).length)) return 3;
  if (
    stage >= 5 &&
    uncertainties(p).some(
      (d) => !p.hypotheses.some((h) => !h.archived && h.approved && h.driverId === d.id)
    )
  )
    return 4;
  if (stage >= 6 && !approvedChainSet(p)) return 5;
  return Math.max(0, stage - 1);
}
