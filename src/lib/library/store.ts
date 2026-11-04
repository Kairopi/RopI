/**
 * Library store: topic folders and saved conversations.
 *
 * Supabase first (tables from supabase-migrations/20261104b_library.sql). If
 * those tables don't exist yet, everything is kept in this browser
 * (localStorage) so nothing is lost, and `storageMode()` says which is in use.
 */

import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/scheduling/utils';

export interface SavedLink {
  title: string;
  url: string;
  kind: 'article' | 'podcast' | 'video' | 'note';
  note?: string;
  added_at: string;
  added_by: 'you' | 'ropi';
}

export interface TopicRow {
  id: string;
  parent_id: string | null;
  name: string;
  match_key: string;
  links: SavedLink[];
  hidden: boolean;
  created_at: string;
}

export interface Turn {
  role: 'you' | 'ropi';
  text: string;
  at: string;
  /** What Ropi did for this turn (explain, news, podcast, jobs, plan, add, quiz, form) */
  kind?: string;
  sources?: { title: string; url: string }[];
}

export interface Conversation {
  id: string;
  topic_key: string | null;
  title: string;
  mode: 'voice' | 'text';
  turns: Turn[];
  started_at: string;
  updated_at: string;
}

export const topicKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// ---- where things live ----
let localOnly: boolean | null = null;
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === 'PGRST205' || e.code === '42P01' || /could not find the table/i.test(e.message ?? ''));
export const storageMode = () => (localOnly ? 'browser' : 'account');

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

const LS = (user: string, what: 'topics' | 'conversations') => `ropi-${what}-v1:${user}`;
function readLocal<T>(user: string, what: 'topics' | 'conversations'): T[] {
  try {
    return JSON.parse(localStorage.getItem(LS(user, what)) ?? '[]');
  } catch {
    return [];
  }
}
function writeLocal<T>(user: string, what: 'topics' | 'conversations', rows: T[]) {
  localStorage.setItem(LS(user, what), JSON.stringify(rows));
}

// ---- topics ----
export async function listTopics(): Promise<TopicRow[]> {
  const user = await uid();
  if (!user) return [];
  if (!localOnly) {
    const { data, error } = await supabase.from('topics').select('*').eq('user_id', user).order('created_at');
    if (!error) {
      localOnly = false;
      return (data ?? []) as TopicRow[];
    }
    if (!missing(error)) throw new Error(error.message);
    localOnly = true;
  }
  return readLocal<TopicRow>(user, 'topics');
}

/** Create or update the folder for a topic key (rename, links, hide) */
export async function saveTopic(input: { match_key: string; parent_id?: string | null } & Partial<Pick<TopicRow, 'name' | 'links' | 'hidden'>>): Promise<TopicRow> {
  const user = await uid();
  if (!user) throw new Error('Not signed in');
  const all = await listTopics();
  const existing = all.find((t) => t.match_key === input.match_key && (t.parent_id ?? null) === (input.parent_id ?? null));
  const row: TopicRow = {
    id: existing?.id ?? generateId(),
    parent_id: input.parent_id ?? null,
    name: (input.name ?? existing?.name ?? input.match_key).trim().slice(0, 120) || input.match_key,
    match_key: input.match_key,
    links: input.links ?? existing?.links ?? [],
    hidden: input.hidden ?? existing?.hidden ?? false,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
  if (!localOnly) {
    const payload = { user_id: user, parent_id: row.parent_id, name: row.name, match_key: row.match_key, links: row.links, hidden: row.hidden, updated_at: new Date().toISOString() };
    const { data, error } = existing
      ? await supabase.from('topics').update(payload).eq('id', existing.id).select().single()
      : await supabase.from('topics').insert(payload).select().single();
    if (!error) return data as TopicRow;
    if (!missing(error)) throw new Error(error.message);
    localOnly = true;
  }
  const rows = readLocal<TopicRow>(user, 'topics').filter((t) => t.id !== row.id);
  writeLocal(user, 'topics', [...rows, row]);
  return row;
}

export async function deleteTopic(id: string): Promise<void> {
  const user = await uid();
  if (!user) return;
  if (!localOnly) {
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (!error) return;
    if (!missing(error)) throw new Error(error.message);
    localOnly = true;
  }
  writeLocal(user, 'topics', readLocal<TopicRow>(user, 'topics').filter((t) => t.id !== id && t.parent_id !== id));
}

// ---- conversations ----
export async function listConversations(limit = 200): Promise<Conversation[]> {
  const user = await uid();
  if (!user) return [];
  if (!localOnly) {
    const { data, error } = await supabase.from('conversations').select('*').eq('user_id', user).order('started_at', { ascending: false }).limit(limit);
    if (!error) {
      localOnly = false;
      return (data ?? []) as Conversation[];
    }
    if (!missing(error)) throw new Error(error.message);
    localOnly = true;
  }
  return readLocal<Conversation>(user, 'conversations').sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit);
}

/** Insert or update a whole conversation (called after every turn) */
export async function saveConversation(c: Conversation): Promise<Conversation> {
  const user = await uid();
  if (!user) return c;
  const now = new Date().toISOString();
  const row = { ...c, updated_at: now };
  if (!localOnly) {
    const payload = { user_id: user, topic_key: row.topic_key, title: row.title.slice(0, 160), mode: row.mode, turns: row.turns, started_at: row.started_at, updated_at: now };
    // Ids made in this browser aren't UUIDs: insert first, then keep the database id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(row.id);
    const { data, error } = isUuid
      ? await supabase.from('conversations').upsert({ id: row.id, ...payload }).select().single()
      : await supabase.from('conversations').insert(payload).select().single();
    if (!error) return data as Conversation;
    if (!missing(error)) throw new Error(error.message);
    localOnly = true;
  }
  const rows = readLocal<Conversation>(user, 'conversations').filter((x) => x.id !== row.id);
  writeLocal(user, 'conversations', [row, ...rows].slice(0, 300));
  return row;
}

export function newConversation(mode: 'voice' | 'text'): Conversation {
  const now = new Date().toISOString();
  return { id: generateId(), topic_key: null, title: 'Conversation', mode, turns: [], started_at: now, updated_at: now };
}
