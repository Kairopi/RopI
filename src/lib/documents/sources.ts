/**
 * Your documents as quotable sources.
 *
 * Pattern from Open Notebook (github.com/lfnovo/open-notebook, MIT, (c) 2024
 * Luis Novo): keep the full text, split it into ~300-word overlapping chunks
 * (their default is 400 tokens with 15% overlap), search the chunks, and make
 * answers cite them. Open Notebook asks the model to cite a document id and
 * trusts it; we go further and only keep a question if its quote is found
 * word-for-word in the chunk it cites.
 *
 * Search is Postgres full-text (search_chunks RPC), so no embeddings service is
 * needed. Tables: supabase-migrations/20261104_receipts_and_sources.sql.
 */

import { supabase } from '@/lib/supabase';
import { callMuse, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';

export interface Source {
  id: string;
  title: string;
  topic: string | null;
  file_name: string | null;
  file_type: 'pdf' | 'docx' | 'text' | null;
  page_count: number | null;
  char_count: number | null;
  summary?: string | null;
  tags?: string[];
  created_at: string;
}

export interface Chunk {
  id: string;
  source_id: string;
  chunk_index: number;
  page: number | null;
  content: string;
}

export interface DraftChunk {
  chunk_index: number;
  page: number | null;
  content: string;
}

const CHUNK_WORDS = 300;
const OVERLAP_WORDS = 45; // 15%

/** Collapse whitespace so quotes can be matched regardless of line breaks */
export const normalizeText = (s: string) =>
  s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Split into ~300-word chunks on paragraph boundaries where possible, with
 * 15% overlap so a fact spanning a boundary is whole in at least one chunk.
 * Pages (PDF) are kept so a quote can say "p. 4".
 */
export function chunkDocument(text: string, pages?: string[]): DraftChunk[] {
  // Flatten to words, remembering the page and where paragraphs end
  const flat: { w: string; page: number | null; endsPara: boolean }[] = [];
  const sourcePages = pages?.length ? pages : [text];
  sourcePages.forEach((pageText, p) => {
    for (const para of pageText.split(/\r?\n\s*\r?\n/)) {
      const words = para.split(/\s+/).filter(Boolean);
      words.forEach((w, i) => flat.push({ w, page: pages?.length ? p + 1 : null, endsPara: i === words.length - 1 }));
    }
  });
  if (!flat.length) return [];

  // Sliding window: at most CHUNK_WORDS, ending on a paragraph break when one is
  // within the last 120 words, then step back OVERLAP_WORDS for the next chunk
  const chunks: DraftChunk[] = [];
  let start = 0;
  while (start < flat.length) {
    let end = Math.min(start + CHUNK_WORDS, flat.length);
    if (end < flat.length) {
      for (let k = end - 1; k > end - 120 && k > start + 40; k--) {
        if (flat[k].endsPara) {
          end = k + 1;
          break;
        }
      }
    }
    const slice = flat.slice(start, end);
    if (slice.length >= 8 || chunks.length === 0) {
      chunks.push({ chunk_index: chunks.length, page: slice[0].page, content: slice.map((x) => x.w).join(' ') });
    }
    if (end >= flat.length) break;
    start = Math.max(end - OVERLAP_WORDS, start + 1);
  }
  return chunks;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

export class SourcesUnavailableError extends Error {
  constructor() {
    super('Saving documents needs the 20261104_receipts_and_sources.sql migration. Run it in the Supabase SQL editor, then try again.');
  }
}
/** Set once Supabase says the sources tables don't exist, so the app stops asking */
export let sourcesMissing = false;
const missingTable = (e: { code?: string; message?: string } | null) => {
  const missing = !!e && (e.code === 'PGRST205' || e.code === '42P01' || e.code === 'PGRST202' || /could not find the (table|function)/i.test(e.message ?? ''));
  if (missing) sourcesMissing = true;
  return missing;
};
export const markSourcesMissing = (e: { code?: string; message?: string } | null) => missingTable(e);

/** Save a parsed document and its chunks. Re-uploading the same text returns the existing source. */
export async function saveSource(input: {
  title: string;
  topic?: string;
  fileName?: string;
  fileType?: 'pdf' | 'docx' | 'text';
  text: string;
  pages?: string[];
}): Promise<{ source: Source; chunks: number; existing: boolean }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error('Not signed in.');

  const content_hash = await sha256(input.text);
  const existing = await supabase.from('sources').select('*').eq('user_id', userId).eq('content_hash', content_hash).maybeSingle();
  if (missingTable(existing.error)) throw new SourcesUnavailableError();
  if (existing.data) {
    const { count } = await supabase.from('source_chunks').select('id', { count: 'exact', head: true }).eq('source_id', existing.data.id);
    return { source: existing.data as Source, chunks: count ?? 0, existing: true };
  }

  const { data: source, error } = await supabase
    .from('sources')
    .insert({
      user_id: userId,
      title: input.title.slice(0, 200),
      topic: input.topic?.slice(0, 120) || null,
      file_name: input.fileName ?? null,
      file_type: input.fileType ?? 'text',
      page_count: input.pages?.length ?? null,
      char_count: input.text.length,
      content_hash,
      full_text: input.text,
    })
    .select('*')
    .single();
  if (missingTable(error)) throw new SourcesUnavailableError();
  if (error || !source) throw new Error(error?.message ?? 'Could not save the document');

  const chunks = chunkDocument(input.text, input.pages);
  for (let i = 0; i < chunks.length; i += 200) {
    const { error: chunkError } = await supabase
      .from('source_chunks')
      .insert(chunks.slice(i, i + 200).map((c) => ({ ...c, source_id: source.id, user_id: userId })));
    if (chunkError) throw new Error(`Saved the document but not its passages: ${chunkError.message}`);
  }
  const tagged = await autoTag(source.id, input.title, input.text);
  return { source: { ...(source as Source), ...tagged }, chunks: chunks.length, existing: false };
}

/**
 * Karakeep-style auto-tagging: Meta Muse reads the start of the document and
 * returns a one-line summary and 3-5 topic tags. Optional: a failure leaves the
 * document saved, just untagged.
 */
export async function autoTag(sourceId: string, title: string, text: string): Promise<{ summary: string | null; tags: string[] }> {
  if (!isMuseConfigured()) return { summary: null, tags: [] };
  try {
    const raw = await callMuse(
      `Read the start of this study document and return ONLY JSON:
{"summary": "one sentence, max 20 words, saying what it covers", "tags": ["3 to 5 short lowercase topic tags, e.g. aws-lambda, cold-starts"]}

Title: ${title.slice(0, 120)}
Text:
${text.slice(0, 3500)}`,
      { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 1200, timeoutMs: 20000 }
    );
    const data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
    const summary = typeof data.summary === 'string' ? data.summary.trim().slice(0, 200) : null;
    const tags: string[] = (Array.isArray(data.tags) ? data.tags : [])
      .filter((x: unknown): x is string => typeof x === 'string')
      .map((x: string) => x.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30))
      .filter(Boolean)
      .slice(0, 5);
    await supabase.from('sources').update({ summary, tags }).eq('id', sourceId);
    return { summary, tags };
  } catch (e) {
    console.warn('Auto-tagging skipped:', e);
    return { summary: null, tags: [] };
  }
}

export async function listSources(): Promise<{ sources: Source[]; available: boolean }> {
  if (sourcesMissing) return { sources: [], available: false };
  const { data, error } = await supabase
    .from('sources')
    .select('id, title, topic, file_name, file_type, page_count, char_count, summary, tags, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (missingTable(error)) return { sources: [], available: false };
  if (error) throw new Error(error.message);
  return { sources: (data ?? []) as Source[], available: true };
}

export async function getSource(id: string): Promise<Source | null> {
  const { data, error } = await supabase.from('sources').select('id, title, topic, file_name, file_type, page_count, char_count, created_at').eq('id', id).maybeSingle();
  if (missingTable(error)) throw new SourcesUnavailableError();
  return (data as Source) ?? null;
}

/**
 * Pick passages to quiz on: full-text matches for the focus (a weak spot) if
 * given, otherwise chunks spread evenly through the document so the quiz
 * covers all of it, not just the first pages.
 */
export async function pickChunks(sourceId: string, focus?: string, k = 6): Promise<Chunk[]> {
  if (focus?.trim()) {
    const { data, error } = await supabase.rpc('search_chunks', { q: focus.trim(), p_source_id: sourceId, k });
    if (missingTable(error)) throw new SourcesUnavailableError();
    if (!error && data?.length) return data as Chunk[];
  }
  const { data, error } = await supabase
    .from('source_chunks')
    .select('id, source_id, chunk_index, page, content')
    .eq('source_id', sourceId)
    .order('chunk_index');
  if (missingTable(error)) throw new SourcesUnavailableError();
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Chunk[];
  if (all.length <= k) return all;
  const step = all.length / k;
  return Array.from({ length: k }, (_, i) => all[Math.floor(i * step)]);
}

/** One document with its full text, for reading it in Ropi */
export interface SourceText {
  source: Source;
  /** The text in reading order, split where pages change (chunk overlap removed) */
  passages: { page: number | null; text: string }[];
}

/** Words two neighbouring chunks share (chunks overlap ~45 words so quotes never break) */
function overlapWords(prev: string[], next: string[], max = 80): number {
  for (let k = Math.min(max, prev.length, next.length); k > 0; k--) {
    let same = true;
    for (let i = 0; i < k; i++) {
      if (prev[prev.length - k + i] !== next[i]) {
        same = false;
        break;
      }
    }
    if (same) return k;
  }
  return 0;
}

/** Stitch chunks back into readable text: drop the repeated overlap, start a new passage when the page changes */
export function stitchChunks(chunks: Pick<Chunk, 'chunk_index' | 'page' | 'content'>[]): SourceText['passages'] {
  const sorted = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const out: SourceText['passages'] = [];
  let prevWords: string[] = [];
  for (const c of sorted) {
    const words = c.content.split(/\s+/).filter(Boolean);
    const fresh = words.slice(overlapWords(prevWords, words));
    prevWords = words;
    if (!fresh.length) continue;
    const last = out[out.length - 1];
    if (last && last.page === c.page) last.text += ' ' + fresh.join(' ');
    else out.push({ page: c.page, text: fresh.join(' ') });
  }
  return out;
}

export async function readSource(id: string): Promise<SourceText | null> {
  const [s, c] = await Promise.all([
    supabase.from('sources').select('id, title, topic, file_name, file_type, page_count, char_count, summary, tags, created_at').eq('id', id).maybeSingle(),
    supabase.from('source_chunks').select('chunk_index, page, content').eq('source_id', id).order('chunk_index'),
  ]);
  if (missingTable(s.error) || missingTable(c.error)) throw new SourcesUnavailableError();
  if (s.error) throw new Error(s.error.message);
  if (!s.data) return null;
  return { source: s.data as Source, passages: stitchChunks((c.data ?? []) as Chunk[]) };
}

/** Put a document in a different folder (folders are matched on the topic name) */
export async function moveSource(id: string, topic: string): Promise<void> {
  const { error } = await supabase.from('sources').update({ topic: topic.trim() }).eq('id', id);
  if (error) throw new Error(error.message);
}
