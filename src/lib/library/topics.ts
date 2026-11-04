/**
 * Topic folders, built from what you already have.
 *
 * A folder exists for every topic you've quizzed on, uploaded a document for,
 * talked to Ropi about, or created yourself. Inside: subtopics (the concepts
 * your quizzes score, plus any you add), documents, quiz attempts with date and
 * time, review cards, conversations, and links you or Ropi saved.
 * Renames and your own folders are stored in `topics`; the rest is read live.
 */

import { supabase } from '@/lib/supabase';
import { listSources, type Source } from '@/lib/documents/sources';
import { listConversations, listTopics, topicKey, type Conversation, type SavedLink, type TopicRow } from './store';

export interface Attempt {
  id: string;
  topic: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  quiz_mode: string | null;
  weak_spots: string[] | null;
  created_at: string;
}

export interface Concept {
  concept: string;
  accuracy: number;
  attempts: number;
  lastAttempt: string | null;
}

export interface TopicFolder {
  key: string;
  name: string;
  /** Name your quizzes and documents use (what new quizzes are made on) */
  topic: string;
  row?: TopicRow;
  confidence: number | null;
  attempts: Attempt[];
  sources: Source[];
  concepts: Concept[];
  subfolders: TopicRow[];
  cards: number;
  dueCards: number;
  conversations: Conversation[];
  links: SavedLink[];
  lastActivity: string | null;
}

const latest = (...isos: (string | null | undefined)[]) => isos.filter(Boolean).sort().pop() ?? null;

export async function loadFolders(userId: string): Promise<TopicFolder[]> {
  const nowIso = new Date().toISOString();
  const [skills, attempts, stats, cards, srcs, convos, rows] = await Promise.all([
    supabase.from('skill_levels').select('topic, confidence, last_quiz_at').eq('user_id', userId),
    supabase.from('quiz_attempts').select('id, topic, score, correct_answers, total_questions, quiz_mode, weak_spots, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(300),
    supabase.from('concept_stats').select('topic, concept, accuracy, attempts, last_attempt_at').eq('user_id', userId),
    supabase.from('concept_cards').select('topic, due_date').eq('user_id', userId),
    listSources().catch(() => ({ sources: [] as Source[], available: false })),
    listConversations().catch(() => [] as Conversation[]),
    listTopics().catch(() => [] as TopicRow[]),
  ]);

  const folders = new Map<string, TopicFolder>();
  const get = (topic: string) => {
    const key = topicKey(topic);
    if (!key) return null;
    let f = folders.get(key);
    if (!f) {
      f = { key, name: topic, topic, confidence: null, attempts: [], sources: [], concepts: [], subfolders: [], cards: 0, dueCards: 0, conversations: [], links: [], lastActivity: null };
      folders.set(key, f);
    }
    return f;
  };

  for (const s of skills.data ?? []) {
    const f = get(s.topic);
    if (!f) continue;
    f.confidence = s.confidence;
    f.lastActivity = latest(f.lastActivity, s.last_quiz_at);
  }
  for (const a of (attempts.data ?? []) as Attempt[]) {
    const f = get(a.topic);
    if (!f) continue;
    f.attempts.push(a);
    f.lastActivity = latest(f.lastActivity, a.created_at);
  }
  for (const c of stats.data ?? []) {
    const f = get(c.topic);
    if (!f) continue;
    f.concepts.push({ concept: c.concept, accuracy: Number(c.accuracy), attempts: c.attempts, lastAttempt: c.last_attempt_at });
  }
  for (const c of cards.data ?? []) {
    const f = get(c.topic);
    if (!f) continue;
    f.cards++;
    if (c.due_date && c.due_date <= nowIso) f.dueCards++;
  }
  for (const s of srcs.sources) {
    const f = get(s.topic || s.title);
    if (!f) continue;
    f.sources.push(s);
    f.lastActivity = latest(f.lastActivity, s.created_at);
  }
  // A conversation can cover several topics ("explain X", then "a podcast on Y"): file it under each
  for (const c of convos) {
    const topics = new Set<string>();
    if (c.topic_key) topics.add(c.topic_key);
    for (const t of c.turns) {
      const topic = t.kind?.split(':').slice(1).join(':').trim();
      if (topic) topics.add(topicKey(topic));
    }
    for (const key of topics) {
      const f = folders.get(key) ?? get(key);
      if (!f) continue;
      f.conversations.push(c);
      f.lastActivity = latest(f.lastActivity, c.updated_at);
    }
  }

  // Your folders: renames, hidden ones, saved links, subfolders, and folders made by hand
  for (const r of rows.filter((x) => !x.parent_id)) {
    const f = folders.get(r.match_key) ?? get(r.name)!;
    if (folders.get(r.match_key) !== f) {
      folders.delete(f.key);
      f.key = r.match_key;
      folders.set(r.match_key, f);
    }
    f.row = r;
    f.name = r.name;
    f.links = r.links ?? [];
    f.lastActivity = latest(f.lastActivity, r.links?.map((l) => l.added_at).sort().pop(), r.created_at);
  }
  for (const r of rows.filter((x) => x.parent_id)) {
    const parent = [...folders.values()].find((f) => f.row?.id === r.parent_id);
    parent?.subfolders.push(r);
  }

  // Names typed all lowercase (or taken from a sentence) read better capitalised; your own renames are kept as typed
  const display = (f: TopicFolder) => (f.row && f.row.name !== f.row.match_key ? f.name : f.name === f.name.toLowerCase() ? f.name.replace(/(^|\s)(\p{L})/gu, (_, s, ch) => s + ch.toUpperCase()) : f.name);

  return [...folders.values()]
    .filter((f) => !f.row?.hidden)
    .map((f) => ({ ...f, name: display(f), concepts: f.concepts.sort((a, b) => a.accuracy - b.accuracy) }))
    .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''));
}
