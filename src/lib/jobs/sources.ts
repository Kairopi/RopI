/**
 * One job search across five public sources, called from the browser (all
 * send CORS headers; checked live 2026-11-04):
 *
 *   Job Seek    company career pages worldwide, location-aware   jseek.co
 *   Remotive    remote jobs                                       remotive.com
 *   Remote OK   remote jobs                                       remoteok.com
 *   Jobicy      remote jobs                                       jobicy.com
 *   Arbeitnow   Europe (mostly Germany) and remote                arbeitnow.com
 *
 * Every source's terms ask for credit and a link back to the posting on their
 * site; Ropi shows the source on each result and saves that link. Remotive
 * asks for few requests (blocks >2/min), so results are cached per search.
 *
 * Not used: The Muse (newest postings were from Aug 2025), Himalayas (terms
 * forbid passing listings on, and no CORS).
 *
 * Remotive and Jobicy search loosely (a copywriter job comes back for
 * "product manager"), Remote OK and Arbeitnow return a whole feed, so every
 * source is filtered the same way: all the words you typed must be in the title.
 */

import { searchJobs as searchJobSeek, htmlToText } from './jobseek-client';

export type SourceId = 'jobseek' | 'remotive' | 'remoteok' | 'jobicy' | 'arbeitnow';

export const SOURCES: Record<SourceId, { name: string; site: string; remoteOnly: boolean }> = {
  jobseek: { name: 'Job Seek', site: 'https://jseek.co', remoteOnly: false },
  remotive: { name: 'Remotive', site: 'https://remotive.com', remoteOnly: true },
  remoteok: { name: 'Remote OK', site: 'https://remoteok.com', remoteOnly: true },
  jobicy: { name: 'Jobicy', site: 'https://jobicy.com', remoteOnly: true },
  arbeitnow: { name: 'Arbeitnow', site: 'https://www.arbeitnow.com', remoteOnly: false },
};

export interface JobPosting {
  key: string;
  source: SourceId;
  /** Job Seek posting id (its description is fetched on save) */
  jobSeekId?: string;
  title: string;
  company: string;
  logo?: string;
  location?: string;
  remote: boolean;
  /** The posting on the source's site (link back, as their terms ask) */
  url: string;
  postedAt?: string;
  salary?: string;
  /** Plain text, when the source includes it */
  description?: string;
}

export interface SourceResult {
  source: SourceId;
  count: number;
  error?: string;
}

const MAX_AGE_DAYS = 60;
const STOP = new Set(['a', 'an', 'and', 'or', 'the', 'of', 'in', 'for', 'to', 'job', 'jobs', 'role', 'roles', 'remote']);

const words = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Every query word appears in the title (plurals/-ing ignored) */
export function titleMatches(title: string, q: string): boolean {
  const t = title.toLowerCase();
  return words(q).every((w) => {
    const stem = w.replace(/(ing|ers|er|es|s)$/, '');
    return new RegExp(`(^|[^a-z0-9])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t);
  });
}

const recent = (iso?: string) => !iso || Date.now() - new Date(iso).getTime() < MAX_AGE_DAYS * 86_400_000;

// Session cache: one network call per source per search (and per feed) for 15 minutes
const TTL = 15 * 60_000;
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) {
      const { at, value } = JSON.parse(hit);
      if (Date.now() - at < TTL) return value as T;
    }
  } catch {
    // no storage: just load
  }
  const value = await load();
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // quota: fine
  }
  return value;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const text = (html?: string) => (html ? htmlToText(html).slice(0, 20_000) : undefined);
const clean = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();

// ---------- sources ----------

async function jobseek(q: string, location: string, modes: string[]): Promise<JobPosting[]> {
  const r = await searchJobSeek(q, location, modes.join(','));
  return r.companies.flatMap((c) =>
    c.postings.map((p) => ({
      key: `jobseek:${p.id}`,
      source: 'jobseek' as const,
      jobSeekId: p.id,
      title: p.title,
      company: c.name,
      logo: c.icon,
      location: p.location,
      remote: /remote/i.test(p.location ?? ''),
      url: p.url,
    }))
  );
}

async function remotive(q: string): Promise<JobPosting[]> {
  const data = await cached(`jobs:remotive:${q.toLowerCase()}`, () => getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=50`));
  return (data.jobs ?? []).map((j: any) => ({
    key: `remotive:${j.id}`,
    source: 'remotive' as const,
    title: clean(j.title),
    company: clean(j.company_name),
    logo: j.company_logo || undefined,
    location: clean(j.candidate_required_location) || 'Remote',
    remote: true,
    url: j.url,
    postedAt: j.publication_date,
    salary: clean(j.salary) || undefined,
    description: text(j.description),
  }));
}

async function remoteok(): Promise<JobPosting[]> {
  const data = await cached('jobs:remoteok', () => getJson('https://remoteok.com/api'));
  return (Array.isArray(data) ? data.slice(1) : []).map((j: any) => ({
    key: `remoteok:${j.id}`,
    source: 'remoteok' as const,
    title: clean(j.position),
    company: clean(j.company),
    logo: j.company_logo || undefined,
    location: clean(j.location) || 'Remote',
    remote: true,
    url: j.url,
    postedAt: j.date,
    salary: j.salary_min ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round((j.salary_max || j.salary_min) / 1000)}k` : undefined,
    description: text(j.description),
  }));
}

async function jobicy(q: string): Promise<JobPosting[]> {
  const data = await cached(`jobs:jobicy:${q.toLowerCase()}`, () => getJson(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(q)}`));
  return (data.jobs ?? []).map((j: any) => ({
    key: `jobicy:${j.id}`,
    source: 'jobicy' as const,
    title: clean(j.jobTitle),
    company: clean(j.companyName),
    logo: j.companyLogo || undefined,
    location: clean(j.jobGeo) || 'Remote',
    remote: true,
    url: j.url,
    postedAt: j.pubDate,
    salary: j.annualSalaryMin ? `${j.salaryCurrency ?? ''} ${Math.round(j.annualSalaryMin / 1000)}k–${Math.round((j.annualSalaryMax || j.annualSalaryMin) / 1000)}k`.trim() : undefined,
    description: text(j.jobDescription),
  }));
}

async function arbeitnow(): Promise<JobPosting[]> {
  const data = await cached('jobs:arbeitnow', () => getJson('https://www.arbeitnow.com/api/job-board-api'));
  return (data.data ?? []).map((j: any) => ({
    key: `arbeitnow:${j.slug}`,
    source: 'arbeitnow' as const,
    title: clean(j.title),
    company: clean(j.company_name),
    location: clean(j.location) || (j.remote ? 'Remote' : undefined),
    remote: !!j.remote,
    url: j.url,
    postedAt: typeof j.created_at === 'number' ? new Date(j.created_at * 1000).toISOString() : j.created_at,
    description: text(j.description),
  }));
}

// ---------- search ----------

export async function searchAllJobs(
  query: string,
  location: string,
  modes: string[]
): Promise<{ postings: JobPosting[]; sources: SourceResult[]; totalJobSeekCompanies?: number }> {
  const q = query.trim();
  const loc = location.trim().toLowerCase();
  const wantRemote = modes.includes('remote');
  const wantOnsite = modes.includes('onsite') || modes.includes('hybrid');

  const tasks: [SourceId, () => Promise<JobPosting[]>][] = [
    ['jobseek', () => jobseek(q, location, modes)],
    ['arbeitnow', arbeitnow],
  ];
  // Remote-only boards only when you want remote work
  if (wantRemote) tasks.push(['remotive', () => remotive(q)], ['remoteok', remoteok], ['jobicy', () => jobicy(q)]);

  const settled = await Promise.allSettled(tasks.map(([, run]) => run()));
  const sources: SourceResult[] = [];
  const all: JobPosting[] = [];

  settled.forEach((s, i) => {
    const id = tasks[i][0];
    if (s.status === 'rejected') {
      sources.push({ source: id, count: 0, error: s.reason instanceof Error ? s.reason.message : 'unavailable' });
      return;
    }
    const kept = s.value.filter((p) => {
      if (!p.title || !p.url || !recent(p.postedAt)) return false;
      // Job Seek already searched by title and place
      if (id === 'jobseek') return true;
      if (!titleMatches(p.title, q)) return false;
      if (p.remote) return wantRemote;
      if (!wantOnsite) return false;
      return !loc || (p.location ?? '').toLowerCase().includes(loc);
    });
    sources.push({ source: id, count: kept.length });
    all.push(...kept);
  });

  // Same job listed on two boards: keep the first (Job Seek first, it's from the company itself)
  const seen = new Set<string>();
  const postings = all.filter((p) => {
    const k = `${p.company.toLowerCase().replace(/[^a-z0-9]/g, '')}|${p.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { postings, sources };
}
