/**
 * Find jobs: search Job Seek (company career pages) and save the ones you want.
 *
 * Saving also fetches the posting's full description from Job Seek, so the job
 * can be scored straight away. If that fails the job is saved without one and
 * Jobs asks you to paste it: a score is never computed against made-up text.
 */

import { useState } from 'react';
import { Search, ExternalLink, Plus, Loader2, Check } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchJobs, fetchJobDescription, type JobSeekPosting, type JobSeekSearchResult } from '@/lib/jobs/jobseek-client';
import { createJobApplication } from '@/lib/jobs/job-service';
import { cn } from '@/lib/utils';

interface JobDiscoveryFeedProps {
  userId: string;
  onJobAdded?: () => void;
  /** URLs already in your list, so they show as saved */
  savedUrls?: Set<string>;
}

const MODES = ['remote', 'hybrid', 'onsite'] as const;

export function JobDiscoveryFeed({ userId, onJobAdded, savedUrls }: JobDiscoveryFeedProps) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [modes, setModes] = useState<string[]>(['remote', 'hybrid']);
  const [results, setResults] = useState<JobSeekSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const search = async () => {
    setShowAll(false);
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const data = await searchJobs(query, location, modes.join(','));
      setResults(data);
      if (!data.companies.length) setError('No jobs found. Try other words or another place.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const save = async (company: string, p: JobSeekPosting) => {
    setAdding(p.id);
    setError(null);
    try {
      const description = await fetchJobDescription(p.id);
      await createJobApplication(userId, {
        job_title: p.title,
        company,
        location: p.location,
        description: description ?? '',
        job_url: p.url,
        source: 'jobseek',
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
        <Button type="submit" disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="animate-spin" /> : <Search />}
          Search
        </Button>
      </form>

      {error && <p className="mt-3 text-[12.5px] text-destructive">{error}</p>}

      {results && results.companies.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              Showing {results.companies.length} of {results.totalCompanies.toLocaleString()} companies hiring
            </span>
            {results.moreAt && (
              <a href={results.moreAt} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                See all on Job Seek
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {results.companies
              .flatMap((c) => c.postings.slice(0, 3).map((p) => ({ c, p })))
              .slice(0, showAll ? undefined : 6)
              .map(({ c, p }) => {
                const isSaved = added.has(p.url) || savedUrls?.has(p.url);
                return (
                  <li key={p.id} className="flex items-center gap-3 bg-card px-4 py-3">
                    {c.icon ? (
                      <img src={c.icon} alt="" className="h-8 w-8 shrink-0 rounded-md border bg-background object-contain" loading="lazy" />
                    ) : (
                      <span className="h-8 w-8 shrink-0 rounded-md border bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{p.title}</div>
                      <div className="truncate text-[12px] text-muted-foreground">
                        {c.name}
                        {p.location ? ` · ${p.location}` : ''}
                      </div>
                    </div>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${p.title} at ${c.name}`}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <Button size="sm" variant={isSaved ? 'ghost' : 'outline'} disabled={isSaved || adding === p.id} onClick={() => save(c.name, p)}>
                      {adding === p.id ? <Loader2 className="animate-spin" /> : isSaved ? <Check /> : <Plus />}
                      {isSaved ? 'Saved' : 'Save'}
                    </Button>
                  </li>
                );
              })}
          </ul>
          {!showAll && results.companies.reduce((n, c) => n + Math.min(3, c.postings.length), 0) > 6 && (
            <button onClick={() => setShowAll(true)} className="mt-2 w-full rounded-lg py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Show more results
            </button>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Listings from{' '}
            <a href="https://jseek.co" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              Job Seek
            </a>{' '}
            (Viktor Shcherbakov,{' '}
            <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              CC BY-NC 4.0
            </a>
            ). Job descriptions belong to the employers.
          </p>
        </div>
      )}
    </div>
  );
}
