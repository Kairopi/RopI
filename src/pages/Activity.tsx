/**
 * History - everything that actually happened, day by day.
 *
 * Every row is a receipt: what happened, when, and how Ropi knows (it saw it,
 * or you told it). Receipts are append-only, so history can't be rewritten.
 * Timeline layout adapted from OpenMuse's ActivityScreen
 * (github.com/CopilotKit/openmuse, MIT, (c) 2026 OpenMuse contributors).
 */

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Briefcase, CalendarClock, ChevronDown, Loader2, AlertCircle } from '@/components/icons';
import { listReceipts, listEarlierRecords, type Receipt, type ReceiptDomain } from '@/lib/receipts';
import { useUserId } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/scheduling/utils';

const DOMAIN = {
  plan: { label: 'Plan', icon: CalendarClock },
  study: { label: 'Study', icon: Brain },
  job: { label: 'Jobs', icon: Briefcase },
} as const;

const VERIFICATION = {
  system_recorded: { label: 'Recorded by Ropi', variant: 'success' as const, help: 'Ropi did this or saw it happen, and saved it at the time.' },
  self_reported: { label: 'You reported', variant: 'outline' as const, help: 'You told Ropi this happened. Ropi did not see it.' },
  external_confirmed: { label: 'Confirmed', variant: 'default' as const, help: 'Confirmed by an outside source.' },
};

const PAGE = 100;

function dayHeading(key: string) {
  const d = new Date(`${key}T12:00`);
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86_400_000));
  const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  return key === today ? `Today · ${date}` : key === yesterday ? `Yesterday · ${date}` : date;
}

const humanKey = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

function humanValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '–';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.every((x) => typeof x !== 'object') ? v.join(', ') : `${v.length} items`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function Activity() {
  const userId = useUserId();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptCount, setReceiptCount] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ReceiptDomain>('all');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    listReceipts(limit)
      .then(async (r) => {
        const earlier = await listEarlierRecords(r.receipts, userId).catch(() => []);
        // Older records only below the oldest receipt shown, so paging stays in time order
        const oldest = r.receipts.length === limit ? r.receipts[r.receipts.length - 1]?.occurred_at : undefined;
        const merged = [...r.receipts, ...earlier.filter((e) => !oldest || e.occurred_at >= oldest)].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
        setReceiptCount(r.receipts.length);
        setReceipts(merged);
        setAvailable(r.available);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [limit, userId]);

  const shown = useMemo(() => receipts.filter((r) => filter === 'all' || r.domain === filter), [receipts, filter]);
  const counts = useMemo(
    () => ({
      all: receipts.length,
      plan: receipts.filter((r) => r.domain === 'plan').length,
      study: receipts.filter((r) => r.domain === 'study').length,
      job: receipts.filter((r) => r.domain === 'job').length,
    }),
    [receipts]
  );
  const days = useMemo(() => {
    const map = new Map<string, Receipt[]>();
    for (const r of shown) {
      const key = formatDate(new Date(r.occurred_at));
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [shown]);

  return (
    <DashboardLayout>
      <PageHeader eyebrow="History" title="What you’ve done" description="Every quiz, review, replan and application, day by day. Entries can’t be edited or deleted." />

      <div className="mb-6 inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Filter">
        {(['all', 'plan', 'study', 'job'] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors ${
              filter === f ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'All' : DOMAIN[f].label} <span className="tabular-nums text-muted-foreground">{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading && receipts.length === 0 ? (
        <div className="flex items-center gap-2 py-12 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your history
        </div>
      ) : !available ? (
        <Card className="flex items-start gap-3 border-warning/40 bg-warning/[0.06] p-5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink" />
          <div className="text-[13.5px]">
            <div className="font-semibold text-warning-ink">History isn't switched on yet</div>
            <p className="mt-1 text-muted-foreground">
              Run <code className="num break-all">supabase-migrations/20261104_receipts_and_sources.sql</code> in the Supabase SQL editor.
            </p>
          </div>
        </Card>
      ) : error ? (
        <Card className="p-5 text-[13px] text-destructive">{error}</Card>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
          <h3 className="text-[17px] font-semibold">Nothing here yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-muted-foreground">
            Take a quiz, review cards, finish a task or tell LifeShift what changed. Each one shows up here with the date and time.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {days.map(([key, items]) => (
            <section key={key} aria-label={dayHeading(key)}>
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <h2 className="text-[14px] font-semibold">{dayHeading(key)}</h2>
                <span className="text-[12px] tabular-nums text-muted-foreground">
                  {items.length} {items.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <Card className="overflow-hidden">
                <ol className="divide-y">
                  {items.map((r) => {
                    const D = DOMAIN[r.domain];
                    const V = VERIFICATION[r.verification];
                    const expanded = open === r.id;
                    const evidence = Object.entries(r.evidence ?? {});
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => setOpen(expanded ? null : r.id)}
                          aria-expanded={expanded}
                          className="flex w-full items-start gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
                        >
                          <span className="num w-[62px] shrink-0 pt-0.5 text-[12px] tabular-nums text-muted-foreground">
                            {new Date(r.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                          <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                            <D.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-medium leading-snug">{r.title}</span>
                            {r.detail && <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{r.detail}</span>}
                          </span>
                          <Badge variant={V.variant} className="hidden shrink-0 sm:inline-flex" title={V.help}>
                            {V.label}
                          </Badge>
                          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        {expanded && (
                          <div className="border-t border-dashed bg-background px-5 py-4 sm:pl-[118px]">
                            <p className="text-[12.5px]">
                              <span className="font-medium">{V.label}.</span> <span className="text-muted-foreground">{V.help}</span>
                            </p>
                            {evidence.length > 0 && (
                              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
                                {evidence.map(([k, v]) => (
                                  <div key={k} className="contents">
                                    <dt className="text-muted-foreground">{humanKey(k)}</dt>
                                    <dd className="num min-w-0 break-words">{humanValue(v)}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                            <p className="mt-3 text-[11px] text-muted-foreground">
                              {new Date(r.occurred_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' })} · by{' '}
                              {r.actor === 'muse' ? 'Meta Muse + Ropi' : r.actor === 'ropi' ? 'Ropi' : 'you'} · entry {r.id.slice(0, 8)}
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </section>
          ))}
          {receiptCount === limit && (
            <div className="text-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)} disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                Show older
              </Button>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
