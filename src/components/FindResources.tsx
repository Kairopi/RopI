/**
 * "Find free resources": live web search for one subtopic (Meta search
 * grounding). Every link shown came back from the search; you choose what
 * to save. Saved ones with a length can fill your spare minutes.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, Check, ExternalLink, Globe, Headphones, Loader2, Play, Plus, RefreshCw, Search } from '@/components/icons';
import { cachedResources, getFreeResources, resourcesSearching, samePage, type FoundResource } from '@/lib/library/find-resources';
import type { SavedLink } from '@/lib/library/store';
import { cn } from '@/lib/utils';

const KIND = {
  video: { label: 'Video', icon: Play },
  podcast: { label: 'Podcast', icon: Headphones },
  course: { label: 'Free course', icon: BookOpen },
  article: { label: 'Read', icon: Globe },
} as const;

export function FindResources({
  subtopic,
  folder,
  saved,
  onSave,
  autoStart = false,
}: {
  subtopic: string;
  folder: string;
  saved: SavedLink[];
  onSave: (links: SavedLink[]) => Promise<void>;
  /** Start searching as soon as the page opens, so results are ready when you look */
  autoStart?: boolean;
}) {
  const [list, setList] = useState<FoundResource[] | null>(() => cachedResources(subtopic, folder));
  const [busy, setBusy] = useState(() => resourcesSearching(subtopic, folder));
  const [shown, setShown] = useState(() => !!cachedResources(subtopic, folder));
  const [error, setError] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);

  const run = (fresh = false) => {
    setBusy(true);
    setError(null);
    setSecs(0);
    getFreeResources(subtopic, folder, fresh)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'The search failed'))
      .finally(() => setBusy(false));
  };

  // Quietly start the search when the page opens (once a day per subtopic)
  useEffect(() => {
    setList(cachedResources(subtopic, folder));
    if (autoStart && !cachedResources(subtopic, folder)) run();
    else if (resourcesSearching(subtopic, folder)) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtopic, folder, autoStart]);

  useEffect(() => {
    if (!busy || !shown) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy, shown]);

  const isSaved = (r: FoundResource) => saved.some((l) => samePage(l.url, r.url));
  const toLink = (r: FoundResource): SavedLink => ({
    title: r.title,
    url: r.url,
    kind: r.kind,
    minutes: r.minutes ?? undefined,
    why: r.why || undefined,
    added_at: new Date().toISOString(),
    added_by: 'ropi',
  });
  const save = async (rs: FoundResource[], id: string) => {
    setSaving(id);
    try {
      await onSave(rs.filter((r) => !isSaved(r)).map(toLink));
    } finally {
      setSaving(null);
    }
  };

  if (!shown) {
    return (
      <Button variant="outline" size="sm" onClick={() => (setShown(true), list || busy ? undefined : run())} className="w-full justify-center">
        <Search />
        Find free resources
      </Button>
    );
  }

  const unsaved = (list ?? []).filter((r) => !isSaved(r));

  return (
    <div className="rounded-xl border bg-background/60">
      <div className="flex items-center gap-2 border-b px-3.5 py-2.5">
        <Search className="h-3.5 w-3.5 text-primary" />
        <span className="flex-1 text-[13px] font-medium">Free resources on {subtopic}</span>
        {list && !busy && (
          <button onClick={() => run(true)} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground" title="Search again">
            <RefreshCw className="h-3 w-3" />
            New search
          </button>
        )}
      </div>

      {busy && (
        <div className="px-3.5 py-4">
          <p className="flex items-center gap-2 text-[13px]">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Searching the web for free videos, docs, courses and podcasts
            <span className="num ml-auto text-[12px] text-muted-foreground">{secs}s</span>
          </p>
          <p className="mt-1 pl-6 text-[12px] text-muted-foreground">Usually 20 to 30 seconds. You can keep working; it finishes in the background.</p>
        </div>
      )}

      {error && !busy && (
        <div className="flex items-center gap-3 px-3.5 py-3 text-[12.5px] text-destructive">
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="ghost" onClick={() => run(true)}>
            Try again
          </Button>
        </div>
      )}

      {list && !busy && (
        <>
          <ul className="divide-y">
            {list.map((r) => {
              const K = KIND[r.kind];
              const done = isSaved(r);
              return (
                <li key={r.url} className="flex items-start gap-3 px-3.5 py-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <K.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-[13.5px] font-medium hover:underline">
                      <span className="truncate">{r.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                    <div className="text-[12px] text-muted-foreground">
                      {[K.label, r.minutes ? `${r.minutes} min` : null, r.site].filter(Boolean).join(' · ')}
                    </div>
                    {r.why && <p className="mt-0.5 text-[12.5px] leading-snug text-foreground/80">{r.why}</p>}
                  </div>
                  <Button size="sm" variant={done ? 'ghost' : 'outline'} disabled={done || saving !== null} onClick={() => save([r], r.url)} className="shrink-0">
                    {saving === r.url ? <Loader2 className="animate-spin" /> : done ? <Check /> : <Plus />}
                    {done ? 'Saved' : 'Save'}
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className={cn('flex flex-wrap items-center gap-2 border-t px-3.5 py-2.5')}>
            <p className="flex-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Every link came back from a live web search just now. Saved ones with a length can fill your spare minutes on Today.
            </p>
            {unsaved.length > 1 && (
              <Button size="sm" variant="ghost" disabled={saving !== null} onClick={() => save(unsaved, 'all')}>
                {saving === 'all' && <Loader2 className="animate-spin" />}
                Save all {unsaved.length}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
