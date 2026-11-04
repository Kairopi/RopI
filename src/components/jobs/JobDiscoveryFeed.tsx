/**
 * Find jobs: one search across five job sources (see lib/jobs/sources.ts).
 *
 * Saving keeps the posting's full description (fetched from Job Seek, or sent
 * by the board), so the job can be scored straight away. If a description is
 * missing, Jobs asks you to paste it: a score is never computed against
 * made-up text. Each result credits and links back to where it came from.
 */

import { useMemo, useState } from 'react';
import { Search, ExternalLink, Plus, Loader2, Check } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchJobDescription } from '@/lib/jobs/jobseek-client';
import { searchAllJobs, SOURCES, type JobPosting, type SourceId, type SourceResult } from '@/lib/jobs/sources';
import { createJobApplication, rememberLogo } from '@/lib/jobs/job-service';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './CompanyLogo';

interface JobDiscoveryFeedProps {
  userId: string;
  onJobAdded?: () => void;
  /** URLs already in your list, so they show as saved */
  savedUrls?: Set<string>;
}

const MODES = ['remote', 'hybrid', 'onsite'] as const;
const PAGE = 8;

const ago = (iso?: string) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
};

/** Mix sources so the first screen isn't all one board */
function interleave(postings: JobPosting[]): JobPosting[] {
  const by = new Map<SourceId, JobPosting[]>();
  for (const p of postings) by.set(p.source, [...(by.get(p.source) ?? []), p]);
  const lists = [...by.values()];
  const out: JobPosting[] = [];
  for (let i = 0; out.length < postings.length; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

export function JobDiscoveryFeed({ userId, onJobAdded, savedUrls }: JobDiscoveryFeedProps) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [modes, setModes] = useState<string[]>(['remote', 'hybrid']);
  const [postings, setPostings] = useState<JobPosting[] | null>(null);
  const [sources, setSources] = useState<SourceResult[]>([]);
  const [only, setOnly] = useState<SourceId | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setLimit(PAGE);
    setOnly(null);
    try {
      const r = await searchAllJobs(query, location, modes);
      setPostings(interleave(r.postings));
      // Jobs you saved before logos were kept pick theirs up from the same posting
      for (const p of r.postings) if (p.logo && savedUrls?.has(p.url)) rememberLogo(p.url, p.company, p.logo);
      setSources(r.sources);
      if (!r.postings.length) setError('No jobs found. Try fewer words, another place, or turn on Remote.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const shown = useMemo(() => (postings ?? []).filter((p) => !only || p.source === only), [postings, only]);

  const save = async (p: JobPosting) => {
    setAdding(p.key);
    setError(null);
    try {
      const description = p.description ?? (p.jobSeekId ? await fetchJobDescription(p.jobSeekId) : null);
      await createJobApplication(userId, {
        job_title: p.title,
        company: p.company,
        location: p.location,
        description: description ?? '',
        job_url: p.url,
        source: p.source,
        company_logo: p.logo,
      });
      setAdded((s) => new Set(s).add(p.url));
      onJobAdded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the job');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div>
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Input aria-label="Job title or keywords" placeholder="Job title, e.g. Product Manager" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Input aria-label="Location" placeholder="City or country (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <div className="inline-flex h-10 rounded-lg bg-muted p-0.5" role="group" aria-label="Work mode">
          {MODES.map((m) => {
            const on = modes.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => setModes((all) => (on ? all.filter((x) => x !== m) : [...all, m]))}
                className={cn(
                  'rounded-md px-2.5 text-[12.5px] font-medium capitalize transition-colors',
                  on ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        <Button type="submit" disabled={searching || !query.trim() || modes.length === 0}>
          {searching ? <Loader2 className="animate-spin" /> : <Search />}
          Search
        </Button>
      </form>
      {!postings && !searching && (
        <p className="mt-2 px-1 text-[12px] text-muted-foreground">Searches Job Seek, Remotive, Remote OK, Jobicy and Arbeitnow at once.</p>
      )}
      {searching && <p className="mt-2 px-1 text-[12px] text-muted-foreground">Searching 5 job sources…</p>}

      {error && <p className="mt-3 text-[12.5px] text-destructive">{error}</p>}

      {postings && postings.length > 0 && (
        <div className="mt-4">
          {/* Where results came from; click to show one source */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]" role="group" aria-label="Filter by source">
            <button
              onClick={() => setOnly(null)}
              aria-pressed={only === null}
              className={cn('rounded-full border px-2.5 py-0.5 font-medium', only === null ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
            >
              All {postings.length}
            </button>
            {sources.map((s) => (
              <button
                key={s.source}
                disabled={!s.count}
                onClick={() => setOnly(s.source)}
                aria-pressed={only === s.source}
                title={s.error ? `${SOURCES[s.source].name} didn’t answer` : undefined}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 tabular-nums',
                  only === s.source ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground'
                )}
              >
                {SOURCES[s.source].name} {s.error ? '–' : s.count}
              </button>
            ))}
          </div>

          <ul className="divide-y overflow-hidden rounded-xl border">
            {shown.slice(0, limit).map((p) => {
              const isSaved = added.has(p.url) || savedUrls?.has(p.url);
              return (
                <li key={p.key} className="flex items-center gap-3 bg-card px-4 py-3">
                  <CompanyLogo src={p.logo} company={p.company} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{p.title}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {[p.company, p.location, p.salary, ago(p.postedAt)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {/* Link back to the posting on the source's site, credited by name (their terms) */}
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener"
                    className="hidden shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
                  >
                    {SOURCES[p.source].name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button size="sm" variant={isSaved ? 'ghost' : 'outline'} disabled={isSaved || adding === p.key} onClick={() => save(p)}>
                    {adding === p.key ? <Loader2 className="animate-spin" /> : isSaved ? <Check /> : <Plus />}
                    {isSaved ? 'Saved' : 'Save'}
                  </Button>
                </li>
              );
            })}
          </ul>
          {shown.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE * 2)} className="mt-2 w-full rounded-lg py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Show more ({shown.length - limit})
            </button>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Listings from{' '}
            {(Object.keys(SOURCES) as SourceId[]).map((id, i, all) => (
              <span key={id}>
                <a href={SOURCES[id].site} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">
                  {SOURCES[id].name}
                </a>
                {i < all.length - 2 ? ', ' : i === all.length - 2 ? ' and ' : ''}
              </span>
            ))}
            . Job Seek data: Viktor Shcherbakov,{' '}
            <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">
              CC BY-NC 4.0
            </a>
            . Job descriptions belong to the employers. You apply on the source’s site.
          </p>
        </div>
      )}
    </div>
  );
}
