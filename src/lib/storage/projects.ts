import { openDB } from 'idb';
import { parseProject, type Project } from '$lib/domain/project';

const db = () =>
  openDB('scenario-designer', 1, {
    upgrade(db) {
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('preferences');
    }
  });
export async function listProjects(): Promise<Project[]> {
  const data = await (await db()).getAll('projects');
  return data.map(parseProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function saveProject(project: Project) {
  const database = await db();
  const tx = database.transaction('projects', 'readwrite');
  await tx.store.put(parseProject(project));
  await tx.done;
}
export async function deleteProject(id: string) {
  await (await db()).delete('projects', id);
}
export async function preference(name: string, value?: string) {
  const database = await db();
  if (value !== undefined) await database.put('preferences', value, name);
  return database.get('preferences', name) as Promise<string | undefined>;
}
export function recoverInterrupted(project: Project) {
  let interrupted = 0;
  project.runs.forEach((r) => {
    if (['queued', 'running'].includes(r.status)) {
      r.unknownCharge = r.status === 'running';
      r.status = 'failed';
      r.error =
        'Interrupted by a reload. Any dispatched request may have been billed. Retry explicitly.';
      interrupted++;
    }
  });
  return interrupted;
}
