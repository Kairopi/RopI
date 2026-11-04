/**
 * Find free resources for one subtopic, with Meta's search grounding
 * (Responses API + web_search). Muse picks and labels them; Ropi keeps only
 * links that came back from the live search, so nothing is made up.
 */
import { MUSE_MODELS } from '@/lib/api/muse';

import { MUSE_BASE as BASE, museAuth, museReady } from '@/lib/api/config';

export interface FoundResource {
  title: string;
  url: string;
  kind: 'video' | 'article' | 'course' | 'podcast';
  minutes: number | null;
  why: string;
  site: string;
}

const KINDS = new Set(['video', 'article', 'course', 'podcast']);

/** Same page? Ignore protocol, www, trailing slash, fragments and tracking params; keep ids like YouTube's v= */
export function samePage(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(u.trim());
      const yt = youtubeId(x);
      if (yt) return `youtube:${yt}`;
      const keep = new URLSearchParams();
      for (const [k, v] of x.searchParams) if (!/^utm_|^ref$|^si$|^feature$/i.test(k)) keep.set(k, v);
      const q = keep.toString();
      return `${x.hostname.replace(/^www\.|^m\./, '')}${x.pathname.replace(/\/+$/, '')}${q ? `?${q}` : ''}`.toLowerCase();
    } catch {
      return u.trim().toLowerCase();
    }
  };
  return norm(a) === norm(b);
}

function youtubeId(x: URL): string | null {
  const host = x.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return x.pathname.slice(1) || null;
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  if (x.searchParams.get('v')) return x.searchParams.get('v');
  return x.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1] ?? null;
}

/** The link without tracking parameters, and YouTube embeds as normal watch pages */
export function cleanUrl(u: string): string {
  try {
    const x = new URL(u);
    const yt = youtubeId(x);
    if (yt) return `https://www.youtube.com/watch?v=${yt}`;
    for (const k of [...x.searchParams.keys()]) if (/^utm_|^ref$|^si$|^feature$|^fbclid$|^gclid$/i.test(k)) x.searchParams.delete(k);
    return x.toString();
  } catch {
    return u;
  }
}

const site = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

const guessKind = (u: string): FoundResource['kind'] =>
  /youtube\.com|youtu\.be|vimeo\.com/i.test(u) ? 'video' : /podcast|spotify\.com|apple\.com\/.*podcast/i.test(u) ? 'podcast' : /coursera|edx\.org|ocw\.mit|khanacademy|freecodecamp|skillbuilder|learn\.microsoft|cloudskillsboost|course/i.test(u) ? 'course' : 'article';

/** Pull the JSON array out of the answer, whatever the model wrapped it in */
function parseList(text: string): Partial<FoundResource>[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function findFreeResources(subtopic: string, folder: string, opts: { exclude?: string[]; timeoutMs?: number } = {}): Promise<FoundResource[]> {
  if (!museReady) throw new Error('Ropi’s assistant isn’t set up, so it can’t search.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 50000);
  const prompt = `Search the web for the best FREE resources to learn "${subtopic}"${folder && folder.toLowerCase() !== subtopic.toLowerCase() ? ` (part of ${folder})` : ''} for a busy adult who studies in short gaps.
Find up to 6, mixing: one short video under 20 minutes, the official documentation or a free course page, one clear article or guide, and a podcast episode if a good one exists.
Rules: free to access (no paywall, no paid-only course). Prefer official docs, universities (MIT OpenCourseWare, OpenStax), Khan Academy, freeCodeCamp, and well-known creators. Every URL must be a page you found in this search, exactly as found.
Return ONLY a JSON array, no other text:
[{"title": "page title", "url": "https://...", "kind": "video|article|course|podcast", "minutes": 12, "why": "max 12 plain words on what it covers"}]
minutes = about how long it takes to watch, listen or read; null if unknown.`;

  try {
    const res = await fetch(`${BASE}/responses`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(await museAuth()) },
      body: JSON.stringify({
        model: MUSE_MODELS.fast,
        input: prompt,
        // 'low' context + minimal reasoning: ~20 s measured, vs ~30 s on 'medium'
        tools: [{ type: 'web_search', search_context_size: 'low' }],
        include: ['web_search_call.results'],
        reasoning: { effort: 'minimal' },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`The web search had a problem (${res.status}): ${data?.error?.message ?? res.statusText}`);

    // Everything the search actually returned: the only links Ropi will show
    const seen: { url: string; title: string }[] = [];
    const texts: string[] = [];
    for (const item of data?.output ?? []) {
      if (item.type === 'web_search_call') for (const r of item.results ?? []) if (r.url) seen.push({ url: r.url, title: r.title || r.url });
      if (item.type !== 'message') continue;
      for (const block of item.content ?? []) {
        if (block.type !== 'output_text') continue;
        texts.push(String(block.text ?? ''));
        for (const a of block.annotations ?? []) if (a.type === 'url_citation' && a.url) seen.push({ url: a.url, title: a.title || a.url });
      }
    }
    if (!seen.length) throw new Error('The search came back empty. Try again in a moment.');

    const exclude = opts.exclude ?? [];
    const out: FoundResource[] = [];
    const add = (r: FoundResource) => {
      if (exclude.some((u) => samePage(u, r.url)) || out.some((o) => samePage(o.url, r.url))) return;
      out.push(r);
    };
    const picked = parseList(texts.filter((t) => t.trim()).pop() ?? '');
    for (const p of picked) {
      const url = String(p.url ?? '');
      const hit = seen.find((s) => samePage(s.url, url));
      if (!hit) continue; // not from the search: dropped
      const minutes = Number(p.minutes);
      const url2 = cleanUrl(hit.url);
      add({
        title: String(p.title || hit.title).slice(0, 140),
        url: url2,
        kind: KINDS.has(String(p.kind)) ? (p.kind as FoundResource['kind']) : guessKind(url2),
        minutes: Number.isFinite(minutes) && minutes > 0 && minutes < 600 ? Math.round(minutes) : null,
        why: String(p.why ?? '').slice(0, 120),
        site: site(url2),
      });
    }
    // Too few survived the check: show the pages the search read, labelled only by what we know
    if (out.length < 3) for (const s of seen.slice(0, 8)) add({ title: s.title.slice(0, 140), url: cleanUrl(s.url), kind: guessKind(s.url), minutes: null, why: '', site: site(s.url) });
    return out.slice(0, 6);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('The search took too long. Try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ---- One search per subtopic per day, shared by every caller (the page starts it, the button shows it)

const CACHE_KEY = 'ropi-found-resources-v1';
const DAY = 24 * 60 * 60 * 1000;
const inflight = new Map<string, Promise<FoundResource[]>>();

type Cached = { at: number; list: FoundResource[] };
function readCache(): Record<string, Cached> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

const cacheKey = (subtopic: string, folder: string) => `${folder}::${subtopic}`.toLowerCase();

/** Already found today? */
export function cachedResources(subtopic: string, folder: string): FoundResource[] | null {
  const c = readCache()[cacheKey(subtopic, folder)];
  return c && Date.now() - c.at < DAY ? c.list : null;
}

/** Find (or reuse today's search). `fresh` searches again. */
export function getFreeResources(subtopic: string, folder: string, fresh = false): Promise<FoundResource[]> {
  const k = cacheKey(subtopic, folder);
  if (!fresh) {
    const hit = cachedResources(subtopic, folder);
    if (hit) return Promise.resolve(hit);
    const running = inflight.get(k);
    if (running) return running;
  }
  const p = findFreeResources(subtopic, folder)
    .then((list) => {
      try {
        const all = readCache();
        all[k] = { at: Date.now(), list };
        localStorage.setItem(CACHE_KEY, JSON.stringify(all));
      } catch {
        /* cache is optional */
      }
      return list;
    })
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

/** Is a search for this subtopic running right now? */
export const resourcesSearching = (subtopic: string, folder: string) => inflight.has(cacheKey(subtopic, folder));
