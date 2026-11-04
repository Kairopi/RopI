/**
 * Last 7 days: what you actually did, from real records.
 *
 * Khoj's "weekly progress" automation, done honestly for a web app: there is
 * no server sending notifications, so this is computed when you open Today,
 * from quiz attempts, FSRS reviews, tasks you checked off and jobs you applied to.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@/components/icons';
import { useWeek } from '@/hooks/useWeek';
import { formatDate } from '@/lib/scheduling/utils';

interface Day {
  date: string;
  label: string;
  count: number;
}

export function WeekInReview({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const tasks = useWeek((s) => s.tasks);
  const [rows, setRows] = useState<{ quizzes: { at: string; secs: number }[]; reviews: string[]; applied: string[] } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    Promise.all([
      supabase.from('quiz_attempts').select('created_at, time_taken_seconds').eq('user_id', userId).gte('created_at', since),
      supabase.from('review_sessions').select('created_at').eq('user_id', userId).gte('created_at', since),
      supabase.from('job_applications').select('applied_at').eq('user_id', userId).gte('applied_at', since),
    ]).then(([q, r, j]) =>
      setRows({
        quizzes: (q.data ?? []).map((x: any) => ({ at: x.created_at, secs: x.time_taken_seconds ?? 0 })),
        reviews: (r.data ?? []).map((x: any) => x.created_at),
        applied: (j.data ?? []).map((x: any) => x.applied_at).filter(Boolean),
      })
    );
  }, [userId]);

  const since = Date.now() - 7 * 86_400_000;
  const done = tasks.filter((t) => t.doneAt && new Date(t.doneAt).getTime() >= since);
  const focusMin = Math.round(
    done.reduce((s, t) => s + (t.actualMinutes ?? t.duration), 0) + (rows?.quizzes.reduce((s, q) => s + q.secs, 0) ?? 0) / 60 + (rows?.reviews.length ?? 0) * (20 / 60)
  );

  const days: Day[] = useMemo(() => {
    const stamps = [...(rows?.quizzes.map((q) => q.at) ?? []), ...(rows?.reviews ?? []), ...(rows?.applied ?? []), ...done.map((t) => t.doneAt!)];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = formatDate(d);
      return {
        date: key,
        label: `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`,
        count: stamps.filter((s) => formatDate(new Date(s)) === key).length,
      };
    });
  }, [rows, done]);
  const max = Math.max(1, ...days.map((d) => d.count));
  const activeDays = days.filter((d) => d.count > 0).length;

  const stats = [
    { label: 'Focus time', value: focusMin >= 60 ? `${Math.round((focusMin / 60) * 10) / 10}h` : `${focusMin}m` },
    { label: 'Quizzes', value: String(rows?.quizzes.length ?? 0) },
    { label: 'Cards reviewed', value: String(rows?.reviews.length ?? 0) },
    { label: 'Tasks done', value: String(done.length) },
  ];

  return (
    <Panel
      id="today-last7"
      title="Last 7 days"
      meta={rows === null ? undefined : `Active ${activeDays} of 7 days`}
      summary={stats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(' · ')}
      actions={
        <Button size="sm" variant="ghost" onClick={() => navigate('/history')}>
          History
          <ArrowRight />
        </Button>
      }
    >

      <div className="flex items-end gap-1.5" aria-label={`Active on ${activeDays} of the last 7 days`}>
        {days.map((d, i) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-14 w-full items-end overflow-hidden rounded-md bg-muted">
              <div
                className={`w-full rounded-md transition-all duration-500 ${i === 6 ? 'bg-primary' : 'bg-primary/45'}`}
                style={{ height: d.count ? `${Math.max(14, (d.count / max) * 100)}%` : 0 }}
                title={`${d.count} thing${d.count === 1 ? '' : 's'} done`}
              />
            </div>
            <span className={`whitespace-nowrap text-[10.5px] tabular-nums ${i === 6 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
              {i === 6 ? 'Today' : d.label}
            </span>
          </div>
        ))}
      </div>

      <dl className="mt-5 grid grid-cols-4 gap-2 border-t pt-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dd className={`font-display text-[20px] font-semibold tabular-nums leading-none tracking-[-0.02em] transition-opacity ${rows === null ? 'opacity-30' : ''}`}>{s.value}</dd>
            <dt className="mt-1 text-[11px] text-muted-foreground">{s.label}</dt>
          </div>
        ))}
      </dl>
      {(rows === null || activeDays === 0 || (rows?.applied.length ?? 0) > 0) && (
        <p className="mt-3 text-[12px] text-muted-foreground">
          {rows === null
            ? 'Loading your week...'
            : activeDays === 0
            ? 'Nothing logged yet. One quiz starts the streak.'
            : `${rows.applied.length} application${rows.applied.length === 1 ? '' : 's'} sent.`}
        </p>
      )}
    </Panel>
  );
}
