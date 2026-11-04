/**
 * Job Seek API client (https://jseek.co, public, CORS-enabled).
 * Jobs come straight from company career pages.
 *
 * Shapes verified against the live API on 2026-11-04 and the pinned MCP server
 * (github-extractions/jobseek/packages/mcp-server/src/tools):
 *   GET /api/v1/search?q&loc&wm&locale   -> { companies: [{ name, icon, url, activeJobs, topPostings: [{ id, title, location, url }] }], totalCompanies, moreAt }
 *   GET /api/v1/resolve?type=locations&q -> { matches: [{ slug, name, type, parentName }] }
 *   GET /api/v1/job?id&locale            -> { id, title, company: { name }, locations: [{ name, type }], salary, employmentType, url, firstSeenAt }
 * There is no job description in the API, so a saved job needs one pasted in before it can be scored.
 */

const BASE = 'https://jseek.co';

export interface JobSeekPosting {
  id: string;
  title: string;
  location?: string;
  url: string;
}

export interface JobSeekCompany {
  name: string;
  icon?: string;
  url?: string;
  activeJobs?: number;
  postings: JobSeekPosting[];
}

export interface JobSeekSearchResult {
  companies: JobSeekCompany[];
  totalCompanies: number;
  moreAt?: string;
}

async function get<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Job search is unavailable right now (${res.status}).`);
  return res.json() as Promise<T>;
}

/** Location name -> Job Seek slug, e.g. "London" -> "london-england-united-kingdom" */
async function locationSlug(q: string): Promise<string | undefined> {
  try {
    const r = await get<{ matches?: { slug: string }[] }>('/api/v1/resolve', { type: 'locations', q, locale: 'en' });
    return r.matches?.[0]?.slug;
  } catch {
    return undefined;
  }
}

export async function searchJobs(query: string, location?: string, workMode?: string): Promise<JobSeekSearchResult> {
  const loc = location?.trim() ? await locationSlug(location.trim()) : undefined;
  const raw = await get<{ companies?: any[]; totalCompanies?: number; moreAt?: string }>('/api/v1/search', {
    q: query.trim(),
    loc,
    wm: workMode || undefined,
    locale: 'en',
  });
  return {
    companies: (raw.companies ?? []).map((c) => ({
      name: String(c.name ?? 'Unknown company'),
      icon: c.icon,
      url: c.url,
      activeJobs: c.activeJobs,
      postings: (c.topPostings ?? []).map((p: any) => ({ id: String(p.id), title: String(p.title), location: p.location ?? undefined, url: String(p.url) })),
    })),
    totalCompanies: raw.totalCompanies ?? 0,
    moreAt: raw.moreAt,
  };
}

/**
 * The full job description. The API doesn't include it, but Job Seek publishes
 * each one at {assets}/job/{id}/{locale}/latest.html (see
 * github-extractions/jobseek/apps/web/src/lib/services/search.ts, descriptionUrl),
 * readable from the browser (CORS *). Verified live 2026-11-04 on 6 of 6 postings.
 * Returned as plain text: the HTML is parsed, never rendered.
 */
const DESCRIPTIONS = 'https://jobseek-assets.colophon-group.org/job';

/** Job Seek posting id from a saved job URL (".../company/spotify?show=<id>") */
export function postingIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)jseek\.co$/.test(u.hostname)) return null;
    const id = u.searchParams.get('show');
    return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** HTML -> readable text: paragraphs and headings on their own lines, list items as "- " */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, template, iframe, noscript').forEach((n) => n.remove());
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push((node.textContent ?? '').replace(/\s+/g, ' '));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as Element).tagName.toLowerCase();
    if (tag === 'br') return void out.push('\n');
    const block = /^(p|div|section|article|h[1-6]|ul|ol|tr|table|header|footer)$/.test(tag);
    if (tag === 'li') out.push('\n- ');
    else if (block) out.push('\n');
    node.childNodes.forEach(walk);
    if (block) out.push('\n');
  };
  walk(doc.body);
  return out
    .join('')
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, all) => l || (all[i - 1] ?? '') !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function fetchJobDescription(postingId: string): Promise<string | null> {
  for (const locale of ['en', 'de', 'fr', 'it']) {
    try {
      const res = await fetch(`${DESCRIPTIONS}/${encodeURIComponent(postingId)}/${locale}/latest.html`);
      if (!res.ok) continue;
      const text = htmlToText(await res.text()).slice(0, 20_000);
      if (text.length > 40) return text;
    } catch {
      // try the next locale
    }
  }
  return null;
}
