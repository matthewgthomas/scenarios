import {
  activeDrivers,
  editHypothesis,
  flagDownstream,
  snapshotChain,
  type Project
} from './project';

export function acceptMerge(p: Project, suggestionId: string) {
  const suggestion = p.mergeSuggestions.find((s) => s.id === suggestionId)!;
  if (suggestion.status !== 'pending') return;
  if (suggestion.kind === 'driver') {
    const records = activeDrivers(p).filter((d) => suggestion.entityIds.includes(d.id));
    if (records.length !== suggestion.entityIds.length)
      throw new Error(
        'Some proposed drivers have been removed. Dismiss this suggestion and request a fresh review.'
      );
    const target = records[0];
    (target.history ??= []).push({
      title: target.title,
      summary: target.summary,
      revision: target.revision
    });
    target.title = suggestion.title;
    target.summary = records
      .map((d) => d.summary)
      .filter(Boolean)
      .join('\n\n');
    target.origins.push(...records.slice(1).flatMap((d) => d.origins));
    target.tags = [...new Set(records.flatMap((d) => d.tags))];
    target.revision++;
    target.approved = false;
    records.slice(1).forEach((d) => {
      d.archived = true;
      d.selected = false;
    });
    flagDownstream(
      p,
      1,
      `Drivers merged into ${target.title}. Original contributions remain available.`
    );
  } else {
    const records = p.hypotheses.filter((h) => !h.archived && suggestion.entityIds.includes(h.id));
    if (
      records.length !== suggestion.entityIds.length ||
      new Set(records.map((h) => h.driverId)).size !== 1
    )
      throw new Error(
        'The proposed hypotheses changed. Dismiss this suggestion and request a fresh review.'
      );
    const target = records[0];
    target.origins.push(...records.slice(1).flatMap((h) => h.origins));
    editHypothesis(p, target.id, suggestion.title, records.map((h) => h.description).join('\n\n'));
    const removedIds = records.slice(1).map((h) => h.id);
    const affected = p.chains.filter((c) =>
      Object.values(c.items).some((id) => id !== null && removedIds.includes(id))
    );
    affected.forEach((c) => {
      snapshotChain(p, c);
      c.revision++;
    });
    records.slice(1).forEach((h) => {
      h.archived = true;
      h.approved = false;
    });
    flagDownstream(
      p,
      4,
      'Equivalent future states merged. Existing combination references are preserved for review.',
      affected.map((c) => c.id)
    );
  }
  suggestion.status = 'accepted';
}
