/**
 * Notes, kept inside the folder (or subtopic) they belong to.
 *
 * Stored with the folder's saved links (kind 'note', the text in `note`), so
 * they live in the `topics` table you already have: no new migration.
 * A subtopic is a `topics` row with parent_id set; it's created the first time
 * you put something in it.
 */
import { generateId } from '@/lib/scheduling/utils';
import { listTopics, saveTopic, topicKey, type SavedLink, type TopicRow } from './store';

export const isNote = (l: SavedLink) => l.kind === 'note';

/** Conversations about a subtopic are filed under "folder::subtopic" */
export const subtopicKey = (folderKey: string, subtopic: string) => `${folderKey}::${topicKey(subtopic)}`;
export const splitKey = (key: string) => {
  const [folder, sub] = key.split('::');
  return { folder, sub: sub ?? null };
};

/** A title that fits on one line: cut at a word, never mid-word */
function shortTitle(s: string, max = 64): string {
  const t = s.trim().replace(/[.:;,]+$/, '');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trim() + '…';
}

export function makeNote(body: string, title: string | null, by: 'you' | 'ropi'): SavedLink {
  const text = body.trim();
  return {
    title: shortTitle(title?.trim() || text.replace(/^- /, '').split(/\n|(?<=[.!?])\s/)[0] || 'Note'),
    url: `note:${generateId()}`,
    kind: 'note',
    note: text.slice(0, 4000),
    added_at: new Date().toISOString(),
    added_by: by,
  };
}

async function folderRow(folder: { key: string; name: string }): Promise<TopicRow> {
  const rows = await listTopics();
  return rows.find((r) => !r.parent_id && r.match_key === folder.key) ?? (await saveTopic({ match_key: folder.key, name: folder.name }));
}

/** The row for a subtopic, created if needed */
export async function subtopicRow(folder: { key: string; name: string }, subtopic: string): Promise<TopicRow> {
  const parent = await folderRow(folder);
  const rows = await listTopics();
  return rows.find((r) => r.parent_id === parent.id && r.match_key === topicKey(subtopic)) ?? (await saveTopic({ match_key: topicKey(subtopic), parent_id: parent.id, name: subtopic }));
}

/** Add a note or link to a folder, or to one of its subtopics */
export async function addTo(folder: { key: string; name: string }, subtopic: string | null, item: SavedLink | SavedLink[]): Promise<void> {
  const row = subtopic ? await subtopicRow(folder, subtopic) : await folderRow(folder);
  const have = row.links ?? [];
  const add = (Array.isArray(item) ? item : [item]).filter((i) => i.kind === 'note' || !have.some((l) => l.url === i.url));
  if (!add.length) return;
  await saveTopic({ match_key: row.match_key, parent_id: row.parent_id, name: row.name, links: [...have, ...add] });
}

/** Remove (or replace) an item by its url */
export async function updateIn(folder: { key: string; name: string }, subtopic: string | null, url: string, next: SavedLink | null): Promise<void> {
  const row = subtopic ? await subtopicRow(folder, subtopic) : await folderRow(folder);
  const links = (row.links ?? []).flatMap((l) => (l.url === url ? (next ? [next] : []) : [l]));
  await saveTopic({ match_key: row.match_key, parent_id: row.parent_id, name: row.name, links });
}
